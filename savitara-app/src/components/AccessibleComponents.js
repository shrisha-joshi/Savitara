/**
 * Accessible UI Components
 * WCAG 2.1 AA Compliant wrappers
 * 
 * These components provide built-in accessibility support
 * while maintaining consistent styling
 */
import React, { forwardRef } from 'react';
import PropTypes from 'prop-types';
import { 
  TouchableOpacity, 
  View, 
  Text, 
  TextInput as RNTextInput,
  Image,
  FlatList,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { 
  accessibleButton, 
  accessibleImage, 
  accessibleInput,
  accessibleListItem,
  accessibleHeader,
  accessibleAlert,
  announceForAccessibility,
} from './accessibility';

/**
 * Accessible Button Component
 * Use this instead of TouchableOpacity for interactive elements
 */
export const AccessibleButton = forwardRef(({
  onPress,
  label,
  hint,
  disabled = false,
  selected = false,
  children,
  style,
  ...props
}, ref) => (
  <TouchableOpacity
    ref={ref}
    onPress={onPress}
    disabled={disabled}
    style={style}
    activeOpacity={0.7}
    {...accessibleButton(label, hint, disabled, selected)}
    {...props}
  >
    {children}
  </TouchableOpacity>
));

AccessibleButton.propTypes = {
  onPress: PropTypes.func,
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  disabled: PropTypes.bool,
  selected: PropTypes.bool,
  children: PropTypes.node,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

AccessibleButton.displayName = 'AccessibleButton';

/**
 * Accessible Icon Button
 * For buttons that only contain an icon
 */
export const AccessibleIconButton = forwardRef(({
  onPress,
  label,
  hint,
  disabled = false,
  icon,
  size = 24,
  color = '#333',
  style,
  IconComponent,
  ...props
}, ref) => (
  <TouchableOpacity
    ref={ref}
    onPress={onPress}
    disabled={disabled}
    style={[styles.iconButton, style]}
    activeOpacity={0.7}
    {...accessibleButton(label, hint, disabled)}
    {...props}
  >
    {IconComponent ? (
      <IconComponent name={icon} size={size} color={disabled ? '#999' : color} />
    ) : (
      <Text style={{ fontSize: size, color: disabled ? '#999' : color }}>{icon}</Text>
    )}
  </TouchableOpacity>
));

AccessibleIconButton.propTypes = {
  onPress: PropTypes.func,
  label: PropTypes.string.isRequired,
  hint: PropTypes.string,
  disabled: PropTypes.bool,
  icon: PropTypes.string.isRequired,
  size: PropTypes.number,
  color: PropTypes.string,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  IconComponent: PropTypes.elementType,
};

AccessibleIconButton.displayName = 'AccessibleIconButton';

/**
 * Accessible Image Component
 * Properly handles decorative vs informative images
 */
export const AccessibleImage = ({
  source,
  alt,
  decorative = false,
  style,
  ...props
}) => (
  <Image
    source={source}
    style={style}
    {...accessibleImage(alt, decorative)}
    {...props}
  />
);

AccessibleImage.propTypes = {
  source: PropTypes.oneOfType([PropTypes.object, PropTypes.number]).isRequired,
  alt: PropTypes.string,
  decorative: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

/**
 * Accessible Text Input
 * Provides proper labeling and error announcements
 */
export const AccessibleTextInput = forwardRef(({
  label,
  hint,
  value,
  error,
  required = false,
  multiline = false,
  style,
  inputStyle,
  labelStyle,
  errorStyle,
  onChangeText,
  ...props
}, ref) => {
  // Announce errors to screen readers
  React.useEffect(() => {
    if (error) {
      announceForAccessibility(`Error: ${error}`);
    }
  }, [error]);

  const fullLabel = required ? `${label}, required` : label;

  return (
    <View style={style}>
      {label && (
        <Text 
          style={[styles.inputLabel, labelStyle]}
          {...accessibleHeader(fullLabel, 6)}
        >
          {label}{required && ' *'}
        </Text>
      )}
      <RNTextInput
        ref={ref}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
        style={[
          styles.textInput,
          error && styles.textInputError,
          multiline && styles.textInputMultiline,
          inputStyle,
        ]}
        placeholderTextColor="#999"
        {...accessibleInput(fullLabel, hint, value, error)}
        {...props}
      />
      {error && (
        <Text 
          style={[styles.errorText, errorStyle]}
          {...accessibleAlert(error, 'error')}
        >
          {error}
        </Text>
      )}
    </View>
  );
});

AccessibleTextInput.propTypes = {
  label: PropTypes.string,
  hint: PropTypes.string,
  value: PropTypes.string,
  error: PropTypes.string,
  required: PropTypes.bool,
  multiline: PropTypes.bool,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  inputStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  labelStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  errorStyle: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
  onChangeText: PropTypes.func,
};

AccessibleTextInput.displayName = 'AccessibleTextInput';

/**
 * Accessible List with Pull-to-Refresh and Pagination
 */
export const AccessibleList = ({
  data,
  renderItem,
  keyExtractor,
  onRefresh,
  onEndReached,
  refreshing = false,
  loading = false,
  emptyMessage = 'No items found',
  listLabel,
  ...props
}) => {
  const accessibleRenderItem = ({ item, index }) => {
    const itemContent = renderItem({ item, index });
    return React.cloneElement(itemContent, {
      ...accessibleListItem(
        item.accessibilityLabel || `Item ${index + 1}`,
        index + 1,
        data.length
      ),
    });
  };

  return (
    <FlatList
      data={data}
      renderItem={accessibleRenderItem}
      keyExtractor={keyExtractor}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            accessibilityLabel="Pull to refresh"
            accessibilityHint="Pull down to refresh the list"
          />
        ) : undefined
      }
      ListEmptyComponent={
        !loading && (
          <View 
            style={styles.emptyContainer}
            accessible={true}
            accessibilityLabel={emptyMessage}
          >
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        )
      }
      accessible={true}
      accessibilityLabel={listLabel || `List with ${data.length} items`}
      {...props}
    />
  );
};

AccessibleList.propTypes = {
  data: PropTypes.array.isRequired,
  renderItem: PropTypes.func.isRequired,
  keyExtractor: PropTypes.func,
  onRefresh: PropTypes.func,
  onEndReached: PropTypes.func,
  refreshing: PropTypes.bool,
  loading: PropTypes.bool,
  emptyMessage: PropTypes.string,
  listLabel: PropTypes.string,
};

/**
 * Accessible Card Component
 * For card-based list items
 */
export const AccessibleCard = ({
  title,
  subtitle,
  onPress,
  hint,
  children,
  style,
  ...props
}) => {
  const label = subtitle ? `${title}, ${subtitle}` : title;
  
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.card, style]}
      activeOpacity={0.7}
      {...accessibleButton(label, hint, false)}
      {...props}
    >
      {children}
    </TouchableOpacity>
  );
};

AccessibleCard.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  onPress: PropTypes.func,
  hint: PropTypes.string,
  children: PropTypes.node,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

/**
 * Accessible Section Header
 * For grouping content with proper heading semantics
 */
export const AccessibleSectionHeader = ({ 
  title, 
  level = 2,
  style,
  ...props 
}) => (
  <Text
    style={[styles.sectionHeader, style]}
    {...accessibleHeader(title, level)}
    {...props}
  >
    {title}
  </Text>
);

AccessibleSectionHeader.propTypes = {
  title: PropTypes.string.isRequired,
  level: PropTypes.number,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

/**
 * Accessible Alert Banner
 * For success/error/warning messages
 */
export const AccessibleAlertBanner = ({
  message,
  type = 'info', // info, success, error, warning
  visible = true,
  onDismiss,
  style,
}) => {
  if (!visible) return null;

  const typeStyles = {
    info: styles.alertInfo,
    success: styles.alertSuccess,
    error: styles.alertError,
    warning: styles.alertWarning,
  };

  return (
    <View 
      style={[styles.alertBanner, typeStyles[type], style]}
      {...accessibleAlert(message, type)}
    >
      <Text style={styles.alertText}>{message}</Text>
      {onDismiss && (
        <TouchableOpacity
          onPress={onDismiss}
          {...accessibleButton('Dismiss alert', 'Double tap to close this message')}
          style={styles.alertDismiss}
        >
          <Text style={styles.alertDismissText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

AccessibleAlertBanner.propTypes = {
  message: PropTypes.string.isRequired,
  type: PropTypes.oneOf(['info', 'success', 'error', 'warning']),
  visible: PropTypes.bool,
  onDismiss: PropTypes.func,
  style: PropTypes.oneOfType([PropTypes.object, PropTypes.array]),
};

const styles = StyleSheet.create({
  iconButton: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
    backgroundColor: '#fff',
    minHeight: 44, // Minimum touch target
  },
  textInputError: {
    borderColor: '#B00020',
  },
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#B00020',
    fontSize: 12,
    marginTop: 4,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 6,
    marginHorizontal: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    minHeight: 44,
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    margin: 16,
  },
  alertInfo: {
    backgroundColor: '#E3F2FD',
    borderColor: '#1976D2',
    borderWidth: 1,
  },
  alertSuccess: {
    backgroundColor: '#E8F5E9',
    borderColor: '#388E3C',
    borderWidth: 1,
  },
  alertError: {
    backgroundColor: '#FFEBEE',
    borderColor: '#D32F2F',
    borderWidth: 1,
  },
  alertWarning: {
    backgroundColor: '#FFF3E0',
    borderColor: '#F57C00',
    borderWidth: 1,
  },
  alertText: {
    flex: 1,
    fontSize: 14,
    color: '#333',
  },
  alertDismiss: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertDismissText: {
    fontSize: 18,
    color: '#666',
  },
});

export default {
  AccessibleButton,
  AccessibleIconButton,
  AccessibleImage,
  AccessibleTextInput,
  AccessibleList,
  AccessibleCard,
  AccessibleSectionHeader,
  AccessibleAlertBanner,
};
