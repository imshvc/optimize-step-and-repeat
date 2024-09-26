// Authors: Nurudin Imsirovic <realnurudinimsirovic@gmail.com>
// Purpose: Determine the best "Step and Repeat" combination for Adobe InDesign
// Created: 2024-09-25 09:04 PM
// Updated: 2024-09-26 02:24 AM

var results = {};

// Default selected unit.
var currentUnit = 'mm';

var elements = {
  controlsDocument: document.querySelector('.controls-fieldset .for-document'),
  controlsItem: document.querySelector('.controls-fieldset .for-item'),

  swapValuesDocument: document.querySelector('.swapValuesDocument'),
  swapValuesItem: document.querySelector('.swapValuesItem'),

  documentWidthInput: document.querySelector('input#documentWidth'),
  documentHeightInput: document.querySelector('input#documentHeight'),
  documentMarginInput: document.querySelector('input#documentMargin'),
  itemWidthInput: document.querySelector('input#itemWidth'),
  itemHeightInput: document.querySelector('input#itemHeight'),

  results: document.querySelector('div.results')
};

var state = {
  // Default control values (in mm)
  documentWidth: 330,
  documentHeight: 488,
  documentMargin: 12.7,
  itemWidth: 90,
  itemHeight: 50
};

// Equalize fieldset heights
(function() {
  var c1 = elements.controlsDocument.getBoundingClientRect().height | 0;
  var c2 = elements.controlsItem.getBoundingClientRect().height | 0;
  var highest = (c1 > c2 ? c1 : c2) + 'px';
  elements.controlsDocument.style.height = highest;
  elements.controlsItem.style.height = highest;
})();

// Low-level: Multiplication is faster
//
// Formulas expressed as: <units> x <pixels>
var supportedUnits = {
  // millimeter
  mm: 3.779527,

  // centimeter
  cm: 37.795275,

  // point
  pt: 1.333,

  // printer's - Source: https://www.unitconverters.net/typography/pica-printer-s-to-pixel-x.htm
  pica: 15.940224,

  // pixel
  px: 1
};

// Dimensions are usually expressed in millimetres (mm)
// but some internal code handles this translation automatically
// when different units are in use.
function optimizeStepAndRepeat(props = {}) {
  props.documentWidth = props.documentWidth ?? null;
  props.documentHeight = props.documentHeight ?? null;
  props.documentMargin = props.documentMargin ?? 12.7; // 12.7mm default margin
  props.itemWidth = props.itemWidth ?? null;
  props.itemHeight = props.itemHeight ?? null;

  // Keep real dimensions for document, as we subtract
  // from it using the margin, otherwise we'd need more
  // code to accomodate for the margins in the for loop.
  props.documentWidthReal = props.documentWidth;
  props.documentHeightReal = props.documentHeight;

  // Sanitize properties
  for (let k in props) {
    // a property cannot be null
    if (props[k] === null) {
      throw new Error(`Property "${k}" is null`);
    }

    // Turn numbers positive
    if (0 > props[k]) {
      props[k] *= -1;
    }
  }

  // Take margin into account;
  // For now we just subtract from the width and height
  // for visuals, we'd need to handle this differently.
  if (props.documentMargin != 0) {
    props.documentWidth -= props.documentMargin * 2;
    props.documentHeight -= props.documentMargin * 2;

    // Too much margin
    if (0 >= props.documentWidth) {
      throw new Error('Too much margin; document width below zero (0)');
    }
    
    if (0 >= props.documentHeight) {
      throw new Error('Too much margin; document height below zero (0)');
    }
  }

  // Finally, determine the best rows-columns combination
  let maxRows = 0;
  let maxColumns = 0;

  // Determine columns
  for (let i = 0, accum = 0; i <= props.documentWidth;) {
    // Item out of bounds
    if (accum + props.itemWidth > props.documentWidth) {
      break;
    }

    accum += props.itemWidth;
    ++maxColumns;
  }

  // Determine rows
  for (let i = 0, accum = 0; i <= props.documentHeight;) {
    // Item out of bounds
    if (accum + props.itemHeight >= props.documentHeight) {
      break;
    }

    accum += props.itemHeight;
    ++maxRows;
  }

  props.maxRows = maxRows;
  props.maxColumns = maxColumns;

  return props;
}

function clearDocumentPreview() {
  elements.results.innerHTML = '';
}

// Generate a document preview as a result of controls evaluation.
function generateDocumentPreview(result, identifier = null) {
  if (identifier === null) {
    return;
  }

  let templateHTML = `
<fieldset class="doc-preview-gen">
  <legend>!docIdentifier!</legend>

  <style>
    .doc-preview-!docIdentifier! {
      --documentWidth: !documentWidth!px;
      --documentHeight: !documentHeight!px;
      --documentMargin: !documentMargin!px;
      --itemWidth: !itemWidth!px;
      --itemHeight: !itemHeight!px;

      --translateMarginX: !translateMarginX!px;
      --translateMarginY: !translateMarginY!px;
    }
  </style>

  <div class="doc-preview doc-preview-!docIdentifier!">
    <div class="doc-margin">
      !docItems!
    </div>
  </div>

  <p>!itemCount!<br>items</p>
</fieldset>
`;

  templateHTML = templateHTML.replace(/\!docIdentifier\!/g, identifier);
  templateHTML = templateHTML.replace(/\!documentWidth\!/g, Math.floor(result.documentWidthReal * 0.25));
  templateHTML = templateHTML.replace(/\!documentHeight\!/g, Math.floor(result.documentHeightReal * 0.25));
  templateHTML = templateHTML.replace(/\!documentMargin\!/g, Math.floor(result.documentMargin * 0.25));
  templateHTML = templateHTML.replace(/\!itemWidth\!/g, Math.floor(result.itemWidth * 0.25));
  templateHTML = templateHTML.replace(/\!itemHeight\!/g, Math.floor(result.itemHeight * 0.25));
  templateHTML = templateHTML.replace(/\!maxColumns\!/g, result.maxColumns);
  templateHTML = templateHTML.replace(/\!itemCount\!/g, result.maxRows * result.maxColumns);

  // Get half difference
  let translateMarginX = result.documentWidth - (result.maxColumns * result.itemWidth);
  let translateMarginY = result.documentHeight - (result.maxRows * result.itemHeight);
  templateHTML = templateHTML.replace(/\!translateMarginX\!/g, Math.floor(translateMarginX * 0.125));
  templateHTML = templateHTML.replace(/\!translateMarginY\!/g, Math.floor(translateMarginY * 0.125));

  let itemsHTML = '';

  for (let i = 0, j = result.maxRows * result.maxColumns; i < j; i++) {
    itemsHTML += '<div class="doc-item"></div>';
  }

  templateHTML = templateHTML.replace(/\!docItems\!/g, itemsHTML);

  elements.results.innerHTML += templateHTML;
  results[identifier].reference = elements.results.querySelector(`doc-preview-${identifier}`);
}

// Utility function for swapping values
function swapValues(widthInput, heightInput) {
  let docWidth = parseFloat(widthInput.value).toFixed(2);
  let docHeight = parseFloat(heightInput.value).toFixed(2);

  // No swap required
  if (docWidth === docHeight) {
    return;
  }

  // Truncate decimal places if they're zero
  if (docWidth.split('.', 2)[1] === '00') {
    docWidth |= 0;
  }

  if (docHeight.split('.', 2)[1] === '00') {
    docHeight |= 0;
  }

  // Swap values client-side
  [widthInput.value, heightInput.value] = [
    docHeight + ' mm',
    docWidth + ' mm'
  ];

  // Swap values in state
  [state.documentWidth, state.documentHeight] = [
    docHeight,
    docWidth
  ];

  commitChanges();
}

// Keep or ignore characters in a string.
function filterString(input, set = '', keep = true) {
  // input is not a string
  if (typeof input !== 'string') {
    return '';
  }

  // empty input
  if (input.length === 0) {
    return '';
  }

  // set is not a string
  if (typeof set !== 'string') {
    return '';
  }

  // empty set
  if (set.length === 0) {
    return '';
  }

  let buffer = '';
  let maxIndex = input.length;
  let currentIndex = 0;

  while (currentIndex != maxIndex) {
    let character = input[currentIndex];

    if (set.includes(character)) {
      if (keep) {
        buffer += character;
      }
    }
    
    ++currentIndex;
  }

  return buffer;
}

// Filter mathematical expressions
function filterMathExpr(input) {
  return filterString(input, '0123456789 +-/*^()%.,');
}

// Filter only numerical values (including decimal point).
function filterNumerical(input) {
  return parseFloat(filterString(input, '0123456789.')) || null;
}

// Quick hack for converting millimetres to pixels
// so we can gauge an approximation for document
// preview.
function millimeterToPixel(mm = 0) {
  // 1/4 the scale
  return mm * 0.25;
}

// Mathematical expression evaluator
function mathExpressionEvaluator(expr = '') {
  if (typeof expr !== 'string') {
    throw new Error('Expression must be a string');
  }

  // Filter only numerical values and mathematical symbols
  expr = filterMathExpr(expr);

  if (expr.length === 0) {
    // Use null so math expressions don't evaluate to NaN
    return null;
  }

  // Borrowed from: https://stackoverflow.com/a/62402481/25752778
  return Function(`'use strict'; return ${expr};`)();
}

// Event handlers for everything else
//
// Handle swap values
elements.swapValuesDocument.addEventListener('click', function(e) {
  swapValues(
    elements.documentWidthInput,
    elements.documentHeightInput
  );
});

elements.swapValuesItem.addEventListener('click', function(e) {
  swapValues(
    elements.itemWidthInput,
    elements.itemHeightInput
  );
});

// Event listener for auto-selecting the value
// inside an input element.
function inputClickEvent(inputElement) {
  inputElement.addEventListener('click', function(e) {
    inputElement.setSelectionRange(0, 9999);
  });
}

// Event listener for enter keys on inputs
function inputEnterEvent(inputElement) {
  inputElement.addEventListener('keyup', function(e) {
    if (e.key !== 'Enter' && e.keyCode !== 9) {
      return;
    }

    try {
      inputMathExpressionEvaluation(e);
    } catch (exception) {
      // Something bad occured
      return;
    }

    // All went ok
    commitChanges();
  });
}

// Event handler for input enters
function inputMathExpressionEvaluation(event) {
  let target = event.target;

  // Discard non-input elements
  if (target instanceof HTMLInputElement === false) {
    return;
  }

  if (event.key !== 'Enter') {
    return;
  }

  // Store original value that we
  // restore when an exception occurs.
  let originalValue = state[target.id] + ' ' + currentUnit;
  let currentValue = target.value.trim();
  let evaluated = '';

  try {
    evaluated = mathExpressionEvaluator(currentValue);

    if (evaluated == 'Infinity') {
      throw new Error('Infinity value');
    }

    if (isNaN(evaluated)) {
      throw new Error('NaN value');
    }

    if (typeof evaluated === 'undefined') {
      throw new Error('undefined');
    }

    if (0 >= evaluated) {
      throw new Error('Negative or zero values not allowed');
    }

    evaluated += ' ' + currentUnit;
  } catch (e) {
    alert('Math Expression Error:\n\n' + e.message);

    // Revert original value and select all text
    target.value = originalValue;
    document.activeElement?.setSelectionRange(0, 9999);

    return;
  }

  target.value = evaluated;
}

// Assign various event handlers for inputs
function assignInputEvents() {
  for (let inputElement of [...arguments]) {
    inputClickEvent(inputElement);
    inputEnterEvent(inputElement);
  }
}

// Finally.. assign these events
assignInputEvents(
  elements.documentWidthInput,
  elements.documentHeightInput,
  elements.documentMarginInput,
  elements.itemWidthInput,
  elements.itemHeightInput
);

// Commit the changes made to controls,
// and recalculate everything, with the
// results.
function commitChanges() {
  // Update state
  state.documentWidth = parseFloat(elements.documentWidthInput.value);
  state.documentHeight = parseFloat(elements.documentHeightInput.value);
  state.documentMargin = parseFloat(elements.documentMarginInput.value);
  state.itemWidth = parseFloat(elements.itemWidthInput.value);
  state.itemHeight = parseFloat(elements.itemHeightInput.value);

  let docWidth = state.documentWidth;
  let docHeight = state.documentHeight;

  // Calculate differences
  let isDocumentSquare = (docWidth === docHeight);

  // TODO: We need margin of error, what if the dimensions is 300x301
  //       this would equate to 'portrait' mode, and vice-versa.
  if (isDocumentSquare) {
    results.square = optimizeStepAndRepeat({
      documentWidth: docWidth,
      documentHeight: docHeight,
      documentMargin: state.documentMargin,
      itemWidth: state.itemWidth,
      itemHeight: state.itemHeight,
    });

    // Generate document previews
    clearDocumentPreview();
    generateDocumentPreview(results.square, 'square');

    return;
  }

  // Non-square document
  results.landscape = {};
  results.portrait = {};

  // Determine lowest and highest value
  let lowest, highest = 0;

  if (docWidth > docHeight) {
    lowest = docHeight;
    highest = docWidth;
  } else {
    lowest = docWidth;
    highest = docHeight;
  }

  results.landscape = optimizeStepAndRepeat({
    documentWidth: highest,
    documentHeight: lowest,
    documentMargin: state.documentMargin,
    itemWidth: state.itemWidth,
    itemHeight: state.itemHeight,
  });

  results.portrait = optimizeStepAndRepeat({
    documentWidth: lowest,
    documentHeight: highest,
    documentMargin: state.documentMargin,
    itemWidth: state.itemWidth,
    itemHeight: state.itemHeight,
  });

  // Generate document previews
  clearDocumentPreview();
  generateDocumentPreview(results.portrait, 'portrait');
  generateDocumentPreview(results.landscape, 'landscape');
}

// TODO: Commit changes on tab index change

// Generate preview on page load
commitChanges();
