function Label(attrs) {
  for (var i = 0, len = Label.KEYS.length; i < len; ++i) {
    var key = Label.KEYS[i];
    if (attrs.hasOwnProperty(key)) {
      this['_' + key] = attrs[key];
    } else {
      this['_' + key] = null;
    }
  }

  if (this._width === null) {
    Labels._widthContext.font = this.getFont();
    this._width = Label._widthContext.measureText(this.getText()).width;
  }
}

Label.KEYS = ['text', 'value', 'opacity', 'font', 'color', 'width'];
Label._widthContext = document.createElement('canvas').getContext('2d');

for (var i = 0, len = Label.KEYS.length; i < len; ++i) {
  (function(g, p) {
    Label.prototype[g] = function() {
      return this[p];
    };
  })(getterName(Label.KEYS[i]), '_' + Label.KEYS[i]);
}

Label.prototype.equals = function(l) {
  for (var i = 0, len = Label.KEYS.length; i < len; ++i) {
    var g = getterName(Label.KEYS[i]);
    if (this[g]() !== l[g]()) {
      return false;
    }
  }
  return true;
};

Label.prototype.draw = function(ctx, x, y) {
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = this.getFont();
  ctx.fillStyle = this.getColor();

  var oldAlpha = ctx.globalAlpha;
  ctx.globalAlpha *= this.getOpacity();

  ctx.fillText(this.getText(), x, y);

  ctx.globalAlpha = oldAlpha;
};

Label.prototype.copyWithOpacity = function(opacity) {
  var attrs = {};
  for (var i = 0, len = Label.KEYS.length; i < len; ++i) {
    var key = Label.KEYS[i];
    attrs[key] = this['_' + key];
  }
  attrs.opacity = opacity;
  return new Label(attrs);
};

function Labels(labelList, maxValue, topY, bottomY) {
  this._labelList = labelList;
  this._maxValue = maxValue;
  this._topY = topY;
  this._bottomY = bottomY;
}

Labels.createLabels = function(config, viewHeight, maxValue) {
  var usableHeight = viewHeight - (config.topMargin + config.bottomMargin);
  if (usableHeight <= 0) {
    return new Labels([], 0, 0, 0);
  }

  var fractionOverMax = config.topLabelSpace / usableHeight;
  var realMax = maxValue / (1 - fractionOverMax);
  var count = Math.floor(usableHeight / config.minSpacing);

  var division = config.roundValue(realMax / count);
  var labelList = [];
  for (var i = 0; i <= count; ++i) {
    var labelValue = division * i;
    var labelText = config.formatValue(labelValue);
    var label = new Label({
      text: labelText,
      value: labelValue,
      opacity: 1,
      font: config.labelFont,
      color: config.labelColor
    });
    labelList.push(label);
  }

  return new Labels(labelList, division*count, config.topMargin,
    viewHeight-config.bottomMargin);
};

Labels.prototype.equals = function(l) {
  if (this._maxValue !== l._maxValue || this._topY !== l._topY ||
    this._bottomY !== l._bottomY || this._labelList.length !== l._labelList.length) {
    return false;
  }
  for (var i = 0, len = this._labelList.length; i < len; ++i) {
    if (!this._labelList[i].equals(l._labelList[i])) {
      return false;
    }
  }
  return true;
};

Labels.prototype.width = function() {
  var w = 0;
  for (var i = 0, len = this._labels.length; i < len; ++i) {
    w = Math.max(w, this._labels[i].getWidth());
  }
  return w;
};

Labels.prototype.draw = function(ctx, x) {
  var w = this.width();
  for (var i = 0, len = this._labelList.length; i < len; ++i) {
    var label = this._labelList[i];
    var x = x + (w-label.getWidth())/2;
    var y = this.yForLabel(i);
    label.draw(ctx, x, y);
  }
};

Labels.prototype.transitionFrame = function(end, fractionDone) {
  var newMaxValue = fractionDone*end._maxValue + (1-fractionDone)*this._maxValue;
  var newTopY = fractionDone*end._topY + (1-fractionDone)*this._topY;
  var newBottomY = fractionDone*end._bottomY + (1-fractionDone)*this._bottomY;

  var labels = [];
  for (var i = 0, len = this._labelList.length; i < len; ++i) {
    var label = this._labelList[i].copyWithOpacity(1 - fractionDone);
    labels.push(label);
  }
  for (var i = 0, len = end._labelList.length; i < len; ++i) {
    var label = end._labelList[i].copyWithOpacity(fractionDone);
    labels.push(label);
  }

  return new Labels(labels, newMaxValue, newTopY, newBottomY);
};

Labels.prototype.getCount = function() {
  return this._labelList.length;
};

Labels.prototype.yForLabel = function(i) {
  var value = this._labelList[i].getValue();
  var pct = value / this._maxValue;
  var height = (this._bottomY - this._topY) * pct;
  return this._bottomY - height;
};

Labels.prototype.opacityForLabel = function(i) {
  return this._labelList[i].getOpacity();
};

function getterName(attr) {
  return 'get' + attr[0].toUpperCase() + attr.substr(1);
}
