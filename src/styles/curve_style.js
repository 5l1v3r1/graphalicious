//deps dot_style.js

function CurveStyle(attrs) {
  DotStyle.call(this, attrs);
}

CurveStyle.prototype = Object.create(DotStyle.prototype);
CurveStyle.prototype.constructor = CurveStyle;

CurveStyle.prototype.createChunkView = function(chunk, dataSource, harmonizerContext) {
  return new CurveChunkView(this._dotAttrs.copyAttributes(), this.copyAttributes(), chunk,
    dataSource, harmonizerContext);
};

exports.CurveStyle = CurveStyle;
