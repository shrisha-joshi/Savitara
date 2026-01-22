/**
 * Accessibility Utilities and Components
 * WCAG 2.1 AA Compliant
 * 
 * Provides:
 * - Accessibility props helpers
 * - Screen reader announcements
 * - Focus management
 * - Accessible components wrappers
 */
import React from 'react';
import { 
  AccessibilityInfo, 
  Platform,
  findNodeHandle,
  UIManager 
} from 'react-native';

/**
 * Common accessibility roles for React Native
 */
export const A11Y_ROLES = {
  BUTTON: 'button',
  LINK: 'link',
  IMAGE: 'image',
  HEADER: 'header',
  TEXT: 'text',
  SEARCH: 'search',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  SWITCH: 'switch',
  ADJUSTABLE: 'adjustable',
  TAB: 'tab',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  PROGRESSBAR: 'progressbar',
  SPINBUTTON: 'spinbutton',
  ALERT: 'alert',
  NONE: 'none',
};

/**
 * Common accessibility states
 */
export const A11Y_STATES = {
  disabled: (isDisabled) => ({ disabled: isDisabled }),
  selected: (isSelected) => ({ selected: isSelected }),
  checked: (isChecked) => ({ checked: isChecked }),
  expanded: (isExpanded) => ({ expanded: isExpanded }),
  busy: (isBusy) => ({ busy: isBusy }),
};

/**
 * Generate accessible props for a button
 * @param {string} label - The accessible label describing the button
 * @param {string} hint - Additional context for what happens when activated
 * @param {boolean} disabled - Whether the button is disabled
 * @param {boolean} selected - Whether the button is selected
 * @returns {object} Accessibility props to spread on the component
 */
export const accessibleButton = (label, hint = null, disabled = false, selected = false) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.BUTTON,
  accessibilityLabel: label,
  accessibilityHint: hint,
  accessibilityState: {
    disabled,
    selected,
  },
});

/**
 * Generate accessible props for a link
 * @param {string} label - The accessible label describing the link
 * @param {string} hint - Description of where the link goes
 * @returns {object} Accessibility props
 */
export const accessibleLink = (label, hint = null) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.LINK,
  accessibilityLabel: label,
  accessibilityHint: hint,
});

/**
 * Generate accessible props for an image
 * @param {string} label - Description of the image content
 * @param {boolean} isDecorative - If true, image is hidden from screen readers
 * @returns {object} Accessibility props
 */
export const accessibleImage = (label, isDecorative = false) => {
  if (isDecorative) {
    return {
      accessible: false,
      accessibilityElementsHidden: true,
      importantForAccessibility: 'no-hide-descendants',
    };
  }
  return {
    accessible: true,
    accessibilityRole: A11Y_ROLES.IMAGE,
    accessibilityLabel: label,
  };
};

/**
 * Generate accessible props for a heading
 * @param {string} label - The heading text (can be same as visible text)
 * @param {number} level - Heading level (1-6) for semantic hierarchy
 * @returns {object} Accessibility props
 */
export const accessibleHeader = (label, level = 1) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.HEADER,
  accessibilityLabel: label,
  // Level hint for iOS VoiceOver
  accessibilityHint: `Heading level ${level}`,
});

/**
 * Generate accessible props for a text input
 * @param {string} label - Label for the input field
 * @param {string} hint - Instructions or format requirements
 * @param {string} value - Current value for announcement
 * @param {string} error - Error message if validation failed
 * @returns {object} Accessibility props
 */
export const accessibleInput = (label, hint = null, value = null, error = null) => {
  let fullLabel = label;
  if (error) {
    fullLabel = `${label}, Error: ${error}`;
  } else if (value) {
    fullLabel = `${label}, Current value: ${value}`;
  }
  
  return {
    accessible: true,
    accessibilityLabel: fullLabel,
    accessibilityHint: hint,
    accessibilityState: {
      disabled: false,
    },
  };
};

/**
 * Generate accessible props for a checkbox or toggle
 * @param {string} label - Label for the checkbox
 * @param {boolean} checked - Whether the checkbox is checked
 * @param {boolean} disabled - Whether the checkbox is disabled
 * @returns {object} Accessibility props
 */
export const accessibleCheckbox = (label, checked = false, disabled = false) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.CHECKBOX,
  accessibilityLabel: label,
  accessibilityState: {
    checked,
    disabled,
  },
});

/**
 * Generate accessible props for a switch/toggle
 * @param {string} label - Label for the switch
 * @param {boolean} value - Whether the switch is on
 * @returns {object} Accessibility props
 */
export const accessibleSwitch = (label, value = false) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.SWITCH,
  accessibilityLabel: label,
  accessibilityState: {
    checked: value,
  },
  accessibilityHint: `Double tap to ${value ? 'turn off' : 'turn on'}`,
});

/**
 * Generate accessible props for a progress indicator
 * @param {number} current - Current value
 * @param {number} max - Maximum value
 * @param {string} label - Label describing what's in progress
 * @returns {object} Accessibility props
 */
export const accessibleProgress = (current, max, label) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.PROGRESSBAR,
  accessibilityLabel: `${label}, ${Math.round((current / max) * 100)} percent complete`,
  accessibilityValue: {
    min: 0,
    max,
    now: current,
    text: `${Math.round((current / max) * 100)}%`,
  },
});

/**
 * Generate accessible props for a slider/adjustable
 * @param {string} label - Label for the slider
 * @param {number} value - Current value
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {string} unit - Unit of measurement (optional)
 * @returns {object} Accessibility props
 */
export const accessibleSlider = (label, value, min, max, unit = '') => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.ADJUSTABLE,
  accessibilityLabel: label,
  accessibilityValue: {
    min,
    max,
    now: value,
    text: `${value}${unit}`,
  },
  accessibilityHint: 'Swipe up or down to adjust',
});

/**
 * Generate accessible props for a tab
 * @param {string} label - Tab label
 * @param {boolean} selected - Whether the tab is selected
 * @param {number} index - Tab index (1-based for announcement)
 * @param {number} total - Total number of tabs
 * @returns {object} Accessibility props
 */
export const accessibleTab = (label, selected, index, total) => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.TAB,
  accessibilityLabel: `${label}, tab ${index} of ${total}`,
  accessibilityState: {
    selected,
  },
});

/**
 * Generate accessible props for a list item
 * @param {string} label - Item description
 * @param {number} index - Item index (1-based)
 * @param {number} total - Total items in list
 * @param {string} hint - Additional context
 * @returns {object} Accessibility props
 */
export const accessibleListItem = (label, index = null, total = null, hint = null) => {
  let fullLabel = label;
  if (index !== null && total !== null) {
    fullLabel = `${label}, ${index} of ${total}`;
  }
  
  return {
    accessible: true,
    accessibilityLabel: fullLabel,
    accessibilityHint: hint,
  };
};

/**
 * Generate accessible props for alert/notification
 * @param {string} message - Alert message
 * @param {string} type - Alert type (success, error, warning, info)
 * @returns {object} Accessibility props
 */
export const accessibleAlert = (message, type = 'info') => ({
  accessible: true,
  accessibilityRole: A11Y_ROLES.ALERT,
  accessibilityLabel: `${type} alert: ${message}`,
  accessibilityLiveRegion: 'assertive',
});

/**
 * Announce a message to screen reader users
 * @param {string} message - Message to announce
 * @param {boolean} assertive - If true, interrupts current announcement
 */
export const announceForAccessibility = (message, assertive = false) => {
  // Both iOS and Android support announceForAccessibility
  // assertive parameter reserved for future platform-specific handling
  AccessibilityInfo.announceForAccessibility(message);
};

/**
 * Check if screen reader is active
 * @returns {Promise<boolean>}
 */
export const isScreenReaderEnabled = async () => {
  return await AccessibilityInfo.isScreenReaderEnabled();
};

/**
 * Check if reduce motion is enabled
 * @returns {Promise<boolean>}
 */
export const isReduceMotionEnabled = async () => {
  return await AccessibilityInfo.isReduceMotionEnabled();
};

/**
 * Focus on a component (for screen readers)
 * @param {React.RefObject} ref - Ref to the component
 */
export const setAccessibilityFocus = (ref) => {
  if (ref?.current) {
    const node = findNodeHandle(ref.current);
    if (node) {
      if (Platform.OS === 'android') {
        UIManager.sendAccessibilityEvent(
          node,
          UIManager.AccessibilityEventTypes.typeViewFocused
        );
      } else {
        AccessibilityInfo.setAccessibilityFocus(node);
      }
    }
  }
};

/**
 * Create accessible live region for dynamic content
 * @param {string} polite - 'polite' or 'assertive'
 * @returns {object} Accessibility props
 */
export const accessibleLiveRegion = (polite = 'polite') => ({
  accessibilityLiveRegion: polite,
});

/**
 * Hide element from accessibility tree (for decorative elements)
 * @returns {object} Accessibility props
 */
export const accessibilityHidden = () => ({
  accessible: false,
  accessibilityElementsHidden: true,
  importantForAccessibility: 'no-hide-descendants',
});

/**
 * Group elements for accessibility (announce as single element)
 * @param {string} label - Combined accessible label
 * @returns {object} Accessibility props
 */
export const accessibilityGroup = (label) => ({
  accessible: true,
  accessibilityLabel: label,
});

export default {
  // Roles
  A11Y_ROLES,
  A11Y_STATES,
  
  // Props generators
  accessibleButton,
  accessibleLink,
  accessibleImage,
  accessibleHeader,
  accessibleInput,
  accessibleCheckbox,
  accessibleSwitch,
  accessibleProgress,
  accessibleSlider,
  accessibleTab,
  accessibleListItem,
  accessibleAlert,
  accessibilityHidden,
  accessibilityGroup,
  accessibleLiveRegion,
  
  // Utilities
  announceForAccessibility,
  isScreenReaderEnabled,
  isReduceMotionEnabled,
  setAccessibilityFocus,
};
