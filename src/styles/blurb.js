//deps includes.js

// Blurb is used to represent a floating information bubble which points to a specific
// location on the screen.
//
// Blurbs can be animated in and out.
// While a blurb is animating, it will emit 'redraw' events periodically.
// When a Blurb is fully faded out, it will emit a 'hidden' event instead of a 'redraw' event.
function Blurb(viewport, config, point, text, harmonizerContext) {
  EventEmitter.call(this);

  this._viewport = viewport;
  this._config = config;
  this._point = point;
  this._text = text;
  this._strikethrough = (this._text[0] === '!');
  this._harmonizer = new window.harmonizer.Harmonizer(harmonizerContext);

  if (point.y+viewport.fullY >= viewport.fullHeight-Blurb.UP_DOWN_THRESHOLD) {
    this._side = Blurb.UP;
  } else if (point.x-viewport.fullX >= viewport.fullWidth/2) {
    this._side = Blurb.LEFT;
  } else {
    this._side = Blurb.RIGHT;
  }

  this._fadingIn = true;
  this._animationElapsed = 0;
  this._animationTimeOffset = 0;
  this._harmonizer.on('animationFrame', this._handleAnimationFrame.bind(this));

  this._cachedCanvas = null;
  this._cachedCanvasDrawRect = null;
  this._cachedCanvasPixelRatio = 0;
}

Blurb.LEFT = 0;
Blurb.RIGHT = 1;
Blurb.UP = 2;
Blurb.DOWN = 3;

// Blurb.ARROW_SIZE is the length of the arrow, in pixels.
Blurb.ARROW_SIZE = 7;

// Blurb.MIN_ARROW_EDGE_DIST is the minimum number of pixels between an arrow and the
// edge of a blurb. This only applies to upward/downward facing blurbs.
Blurb.MIN_ARROW_EDGE_DIST = 2;

// Blurb.MIN_EDGE_DISTANCE is the minimum number of pixels between the edge of a blurb
// and the edge of the full viewport.
Blurb.MIN_EDGE_DISTANCE = 2;

// Blurb.UP_DOWN_THRESHOLD is used to compute the direction a blurb faces given a target point.
// If the point is less than or equal to UP_DOWN_THRESHOLD from the top or bottom of the viewport,
// the corresponding blurb will face up or down.
Blurb.UP_DOWN_THRESHOLD = 30;

// Blurb.SCROLLBAR_HEIGHT determines the number of pixels at the bottom of the viewport
// which should be considered off-limits to the Blurb.
Blurb.SCROLLBAR_HEIGHT = 14;

// Blurb.SIDE_MARGINS determines how many pixels appear to the sides of the text in a blurb.
Blurb.SIDE_MARGINS = 10;

// Blurb.CACHE_INSET determines how many pixels of "buffer space" the cached canvas shoudl use.
// This can't be 0 or else the shadow behind the blurb would get cut off.
Blurb.CACHE_INSET = 5;

// These constants control fade animation timing.
Blurb.IN_DELAY = 200;
Blurb.IN_DURATION = 90;
Blurb.OUT_DURATION = 150;

Blurb.prototype = Object.create(EventEmitter.prototype);

Blurb.prototype.harmonizer = function() {
  return this._harmonizer;
};

Blurb.prototype.getPoint = function() {
  return this._point;
};

Blurb.prototype.getText = function() {
  return this._text;
};

Blurb.prototype.fadeIn = function() {
  if (this._fadingIn && this._harmonizer.isAnimating()) {
    return;
  }

  var alpha = this._currentAlpha();
  if (alpha === 1) {
    return;
  } else if (alpha > 0) {
    this._animationTimeOffset = Blurb.IN_DELAY + Blurb.IN_DURATION*alpha;
  } else {
    this._animationTimeOffset = 0;
  }

  this._fadingIn = true;
  this._animationElapsed = 0;

  // NOTE: we stop() before we start() to reset harmonizer's elapsed counter.
  this._harmonizer.stop();
  this._harmonizer.start();
};

Blurb.prototype.fadeOut = function() {
  if (!this._fadingIn) {
    return;
  }

  var alpha = this._currentAlpha();
  if (alpha < 1) {
    this._animationTimeOffset = Blurb.OUT_DURATION*(1-alpha);
  } else {
    this._animationTimeOffset = 0;
  }

  this._fadingIn = false;
  this._animationElapsed = 0;

  // NOTE: we stop() before we start() to reset harmonizer's elapsed counter.
  this._harmonizer.stop();
  this._harmonizer.start();
};

Blurb.prototype.draw = function(context) {
  var alpha = this._currentAlpha();
  if (alpha === 0) {
    return;
  }

  this._updateCachedCanvas();

  var oldAlpha = context.globalAlpha;
  context.globalAlpha *= alpha;

  context.drawImage(this._cachedCanvas, this._cachedCanvasDrawRect.x,
    this._cachedCanvasDrawRect.y, this._cachedCanvasDrawRect.width,
    this._cachedCanvasDrawRect.height);

  context.globalAlpha = oldAlpha;
};

Blurb.prototype._updateCachedCanvas = function() {
  var pixelRatio = Math.ceil(window.crystal.getRatio());
  if (pixelRatio === this._cachedCanvasPixelRatio) {
    return;
  }
  this._cachedCanvasPixelRatio = pixelRatio;
  this._cachedCanvas = document.createElement('canvas');

  var ctx = this._cachedCanvas.getContext('2d');
  ctx.font = this._config.getBlurbFont();
  var contentWidth = ctx.measureText(this._textToDraw()).width + Blurb.SIDE_MARGINS;
  // TODO: figure out a real way to compute the contentHeight. This may require
  // some DOM voodoo--oh my.
  var contentHeight = 30;

  switch (this._side) {
  case Blurb.LEFT:
  case Blurb.RIGHT:
    this._cachedCanvas.width = (Blurb.CACHE_INSET*2 + Blurb.ARROW_SIZE + contentWidth) *
      pixelRatio;
    this._cachedCanvas.height = (Blurb.CACHE_INSET*2 + contentHeight) * pixelRatio;
    break;
  case Blurb.UP:
  case Blurb.DOWN:
    this._cachedCanvas.width = (Blurb.CACHE_INSET*2 + contentWidth) * pixelRatio;
    this._cachedCanvas.height = (Blurb.CACHE_INSET*2 + Blurb.ARROW_SIZE + contentHeight) *
      pixelRatio;
    break;
  }

  var ctx = this._cachedCanvas.getContext('2d');
  ctx.font = this._config.getBlurbFont();
  ctx.scale(pixelRatio, pixelRatio);
  ctx.translate(Blurb.CACHE_INSET, Blurb.CACHE_INSET);

  ctx.fillStyle = 'white';
  ctx.beginPath();
  var textPosition = null;
  switch (this._side) {
  case Blurb.LEFT:
    var midY = contentHeight/2;
    ctx.moveTo(contentWidth+Blurb.ARROW_SIZE, midY);
    ctx.lineTo(contentWidth, midY-Blurb.ARROW_SIZE);
    ctx.lineTo(contentWidth, 0);
    ctx.lineTo(0, 0);
    ctx.lineTo(0, contentHeight);
    ctx.lineTo(contentWidth, contentHeight);
    ctx.lineTo(contentWidth, midY+Blurb.ARROW_SIZE);
    textPosition = {x: contentWidth/2, y: midY};
    this._cachedCanvasDrawRect = {
      x: this._point.x - Blurb.CACHE_INSET - contentWidth - Blurb.ARROW_SIZE,
      y: this._point.y - Blurb.CACHE_INSET - midY
    };
    break;
  case Blurb.RIGHT:
    var midY = contentHeight/2;
    ctx.moveTo(0, midY);
    ctx.lineTo(Blurb.ARROW_SIZE, midY-Blurb.ARROW_SIZE);
    ctx.lineTo(Blurb.ARROW_SIZE, 0);
    ctx.lineTo(Blurb.ARROW_SIZE+contentWidth, 0);
    ctx.lineTo(Blurb.ARROW_SIZE+contentWidth, contentHeight);
    ctx.lineTo(Blurb.ARROW_SIZE, contentHeight);
    ctx.lineTo(Blurb.ARROW_SIZE, midY+Blurb.ARROW_SIZE);
    textPosition = {x: Blurb.ARROW_SIZE+contentWidth/2, y: midY};
    this._cachedCanvasDrawRect = {
      x: this._point.x - Blurb.CACHE_INSET,
      y: this._point.y - Blurb.CACHE_INSET - midY
    };
    break;
  case Blurb.UP:
    var leftOffset = this._point.x - contentWidth/2;
    var viewportRight = this._viewport.fullX + this._viewport.fullWidth;
    var viewportBottom = this._viewport.fullY + this._viewport.fullHeight;
    if (leftOffset < Blurb.MIN_EDGE_DISTANCE) {
      leftOffset = Blurb.MIN_EDGE_DISTANCE;
    } else if (leftOffset > viewportRight-Blurb.MIN_EDGE_DISTANCE-contentWidth) {
      leftOffset = viewportRight-Blurb.MIN_EDGE_DISTANCE-contentWidth;
    }
    var arrowOffset = this._point.x - leftOffset;
    var maxY = viewportBottom - (Blurb.CACHE_INSET + contentHeight);
    if (arrowOffset+Blurb.ARROW_SIZE >= contentWidth-Blurb.MIN_ARROW_EDGE_DIST ||
        arrowOffset-Blurb.ARROW_SIZE < Blurb.MIN_ARROW_EDGE_DIST) {
      // The arrow is too far to the edge of the blurb, so we do not draw it.
      ctx.rect(0, 0, contentWidth, contentHeight);
    } else {
      maxY -= Blurb.ARROW_SIZE;
      ctx.moveTo(0, 0);
      ctx.lineTo(0, contentHeight);
      ctx.lineTo(arrowOffset-Blurb.ARROW_SIZE, contentHeight);
      ctx.lineTo(arrowOffset, contentHeight+Blurb.ARROW_SIZE);
      ctx.lineTo(arrowOffset+Blurb.ARROW_SIZE, contentHeight);
      ctx.lineTo(contentWidth, contentHeight);
      ctx.lineTo(contentWidth, 0);
    }
    textPosition = {x: contentWidth/2, y: contentHeight/2};
    this._cachedCanvasDrawRect = {
      x: leftOffset - Blurb.CACHE_INSET,
      y: this._point.y - Blurb.CACHE_INSET - contentHeight - Blurb.ARROW_SIZE
    };
    break;
  default:
    throw new Error('side currently unsupported: ' + this._side);
  }

  ctx.closePath();
  ctx.shadowBlur = 4;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
  ctx.fill();
  ctx.shadowColor = 'transparent';

  this._cachedCanvasDrawRect.width = this._cachedCanvas.width / pixelRatio;
  this._cachedCanvasDrawRect.height = this._cachedCanvas.height / pixelRatio;

  ctx.fillStyle = this._config.getBlurbTextColor();
  ctx.font = this._config.getBlurbFont();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText(this._textToDraw(), textPosition.x, textPosition.y);

  if (this._strikethrough) {
    ctx.strokeStyle = this._config.getBlurbTextColor();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(textPosition.x-(contentWidth/2)+(Blurb.SIDE_MARGINS/2), textPosition.y);
    ctx.lineTo(textPosition.x+(contentWidth/2)-(Blurb.SIDE_MARGINS/2), textPosition.y);
    ctx.stroke();
  }
};

Blurb.prototype._textToDraw = function() {
  if (this._strikethrough || (this._text[0] === '\\')) {
    return this._text.substr(1);
  }
  return this._text;
};

Blurb.prototype._currentAlpha = function() {
  var elapsedTime = this._animationElapsed + this._animationTimeOffset;
  if (this._fadingIn) {
    return Math.max(0, Math.min(1, (elapsedTime-Blurb.IN_DELAY)/Blurb.IN_DURATION));
  } else {
    return 1 - Math.max(0, Math.min(1, elapsedTime/Blurb.OUT_DURATION));
  }
};

Blurb.prototype._handleAnimationFrame = function(time) {
  this.harmonizer().requestPaint();

  this._animationElapsed = time;
  var alpha = this._currentAlpha();
  if ((alpha === 1 && this._fadingIn) || (alpha === 0 && !this._fadingIn)) {
    this._harmonizer.stop();
    if (!this._fadingIn) {
      this.emit('hidden');
    }
  }
};
