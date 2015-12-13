var SMALL_NUM = 0.001;

var assert = require('assert');

var importRes = require('./importer')([
  'base/event_emitter.js', 'base/color_scheme.js', 'styles/attrs.js',
  'styles/utilities.js', 'styles/full_curve_style.js'
], ['FullCurveStyle', 'ColorScheme']);

var FullCurveStyle = importRes.FullCurveStyle;
var ColorScheme = importRes.ColorScheme;

function testComputeRange() {
  var style = new FullCurveStyle({
    leftMargin: 7,
    rightMargin: 9,
    minWidth: 50,
    colorScheme: new ColorScheme('red', 'blue')
  });

  var pointCounts = [10, 50, 100];
  for (var i = 0, len = pointCounts.length; i < len; ++i) {
    var count = pointCounts[i];
    var range = style.computeRange({left: 0, width: 50}, count);
    assert(range.startIndex === 0);
    assert(range.length === count);

    range = style.computeRange({left: 0, width: 7-SMALL_NUM}, count);
    assert(range.startIndex === 0);
    assert(range.length === 1);

    range = style.computeRange({left: 0, width: SMALL_NUM}, count);
    assert(range.startIndex === 0);
    assert(range.length === 1);

    range = style.computeRange({left: 7-SMALL_NUM*2, width: SMALL_NUM}, count);
    assert(range.startIndex === 0);
    assert(range.length === 1);

    range = style.computeRange({left: 50-9+SMALL_NUM, width: SMALL_NUM}, count);
    assert(range.startIndex === count-1);
    assert(range.length === 1);

    range = style.computeRange({left: 50-SMALL_NUM, width: SMALL_NUM}, count);
    assert(range.startIndex === count-1);
    assert(range.length === 1);

    range = style.computeRange({left: 50-9/2, width: 1000}, count);
    assert(range.startIndex === count-1);
    assert(range.length === 1);

    var spacing = 34 / (count - 1);

    range = style.computeRange({left: 7 + spacing*3 - SMALL_NUM, width: spacing + SMALL_NUM*2},
      count);
    assert(range.startIndex === 2);
    assert(range.length === 4);

    range = style.computeRange({left: 7 + spacing*3 - SMALL_NUM, width: spacing*4 + SMALL_NUM*2},
      count);
    assert(range.startIndex === 2);
    assert(range.length === 7);

    range = style.computeRange({left: 7 + spacing*3 - SMALL_NUM, width: spacing*4},
      count);
    assert(range.startIndex === 2);
    assert(range.length === 6);

    range = style.computeRange({left: 7+SMALL_NUM, width: spacing-SMALL_NUM*2}, count);
    assert(range.startIndex === 0);
    assert(range.length === 2);

    range = style.computeRange({left: 7+SMALL_NUM, width: spacing}, count);
    assert(range.startIndex === 0);
    assert(range.length === 3);

    range = style.computeRange({left: 50-9-spacing+SMALL_NUM, width: spacing-SMALL_NUM*2}, count);
    assert(range.startIndex === count-2);
    assert(range.length === 2);

    range = style.computeRange({left: 50-9-spacing-SMALL_NUM, width: spacing}, count);
    assert(range.startIndex === count-3);
    assert(range.length === 3);
  }
}

testComputeRange();

console.log('PASS');
