/**
 * React Hook for Form Validation
 * Provides easy-to-use form state management with validation
 */
import { useState, useCallback, useMemo } from 'react';

/**
 * useForm hook for managing form state, validation, and submission
 * 
 * @param {Object} options - Configuration options
 * @param {Object} options.initialValues - Initial form values
 * @param {Object} options.validationSchema - Validation schema from validation.js
 * @param {Function} options.onSubmit - Form submission handler
 * @param {boolean} options.validateOnChange - Validate on every change (default: false)
 * @param {boolean} options.validateOnBlur - Validate on field blur (default: true)
 * 
 * @returns {Object} Form state and handlers
 */
export function useForm({
  initialValues = {},
  validationSchema = null,
  onSubmit,
  validateOnChange = false,
  validateOnBlur = true,
}) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [submitCount, setSubmitCount] = useState(0);

  /**
   * Validate a single field
   */
  const validateField = useCallback(
    (field, value = values[field]) => {
      if (!validationSchema) return null;
      return validationSchema.validateField(field, value, values);
    },
    [validationSchema, values]
  );

  /**
   * Validate all fields
   */
  const validateForm = useCallback(() => {
    if (!validationSchema) return { isValid: true, errors: {} };
    setIsValidating(true);
    const result = validationSchema.validate(values);
    setErrors(result.errors);
    setIsValidating(false);
    return result;
  }, [validationSchema, values]);

  /**
   * Handle field value change
   */
  const handleChange = useCallback(
    (field) => (eventOrValue) => {
      const value = eventOrValue?.target?.value ?? eventOrValue;
      
      setValues((prev) => ({
        ...prev,
        [field]: value,
      }));

      if (validateOnChange && touched[field]) {
        const error = validateField(field, value);
        setErrors((prev) => ({
          ...prev,
          [field]: error,
        }));
      }
    },
    [validateOnChange, validateField, touched]
  );

  /**
   * Handle field blur
   */
  const handleBlur = useCallback(
    (field) => () => {
      setTouched((prev) => ({
        ...prev,
        [field]: true,
      }));

      if (validateOnBlur) {
        const error = validateField(field);
        setErrors((prev) => ({
          ...prev,
          [field]: error,
        }));
      }
    },
    [validateOnBlur, validateField]
  );

  /**
   * Set a single field value
   */
  const setFieldValue = useCallback((field, value) => {
    setValues((prev) => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  /**
   * Set a single field error
   */
  const setFieldError = useCallback((field, error) => {
    setErrors((prev) => ({
      ...prev,
      [field]: error,
    }));
  }, []);

  /**
   * Set a field as touched
   */
  const setFieldTouched = useCallback((field, isTouched = true) => {
    setTouched((prev) => ({
      ...prev,
      [field]: isTouched,
    }));
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (event) => {
      if (event?.preventDefault) {
        event.preventDefault();
      }

      setSubmitCount((count) => count + 1);
      
      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, field) => ({ ...acc, [field]: true }),
        {}
      );
      setTouched(allTouched);

      // Validate form
      const { isValid, errors: validationErrors } = validateForm();
      
      if (!isValid) {
        setErrors(validationErrors);
        return;
      }

      if (onSubmit) {
        setIsSubmitting(true);
        try {
          await onSubmit(values);
        } finally {
          setIsSubmitting(false);
        }
      }
    },
    [values, validateForm, onSubmit]
  );

  /**
   * Reset form to initial values
   */
  const resetForm = useCallback((newInitialValues = initialValues) => {
    setValues(newInitialValues);
    setErrors({});
    setTouched({});
    setSubmitCount(0);
  }, [initialValues]);

  /**
   * Get props for a field
   */
  const getFieldProps = useCallback(
    (field) => ({
      value: values[field] ?? '',
      onChangeText: handleChange(field),
      onBlur: handleBlur(field),
      error: touched[field] && errors[field] ? errors[field] : null,
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  /**
   * Get props for a web input
   */
  const getInputProps = useCallback(
    (field) => ({
      value: values[field] ?? '',
      onChange: handleChange(field),
      onBlur: handleBlur(field),
      error: Boolean(touched[field] && errors[field]),
      helperText: touched[field] && errors[field] ? errors[field] : '',
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  /**
   * Check if form is valid
   */
  const isValid = useMemo(() => {
    return Object.keys(errors).every((key) => !errors[key]);
  }, [errors]);

  /**
   * Check if form has been modified
   */
  const isDirty = useMemo(() => {
    return JSON.stringify(values) !== JSON.stringify(initialValues);
  }, [values, initialValues]);

  return {
    // State
    values,
    errors,
    touched,
    isSubmitting,
    isValidating,
    isValid,
    isDirty,
    submitCount,
    
    // Setters
    setValues,
    setErrors,
    setTouched,
    setFieldValue,
    setFieldError,
    setFieldTouched,
    
    // Handlers
    handleChange,
    handleBlur,
    handleSubmit,
    resetForm,
    validateForm,
    validateField,
    
    // Helper props getters
    getFieldProps,
    getInputProps,
  };
}

/**
 * useFieldArray hook for managing arrays in forms
 * 
 * @param {Object} options - Configuration
 * @param {Function} options.setFieldValue - setFieldValue from useForm
 * @param {Array} options.values - Current array values
 * @param {string} options.name - Field name in form
 */
export function useFieldArray({ setFieldValue, values, name }) {
  const fields = values || [];

  const push = useCallback(
    (value) => {
      setFieldValue(name, [...fields, value]);
    },
    [setFieldValue, name, fields]
  );

  const remove = useCallback(
    (index) => {
      setFieldValue(
        name,
        fields.filter((_, i) => i !== index)
      );
    },
    [setFieldValue, name, fields]
  );

  const insert = useCallback(
    (index, value) => {
      const newFields = [...fields];
      newFields.splice(index, 0, value);
      setFieldValue(name, newFields);
    },
    [setFieldValue, name, fields]
  );

  const move = useCallback(
    (from, to) => {
      const newFields = [...fields];
      const [removed] = newFields.splice(from, 1);
      newFields.splice(to, 0, removed);
      setFieldValue(name, newFields);
    },
    [setFieldValue, name, fields]
  );

  const swap = useCallback(
    (indexA, indexB) => {
      const newFields = [...fields];
      [newFields[indexA], newFields[indexB]] = [newFields[indexB], newFields[indexA]];
      setFieldValue(name, newFields);
    },
    [setFieldValue, name, fields]
  );

  const replace = useCallback(
    (index, value) => {
      const newFields = [...fields];
      newFields[index] = value;
      setFieldValue(name, newFields);
    },
    [setFieldValue, name, fields]
  );

  return {
    fields,
    push,
    remove,
    insert,
    move,
    swap,
    replace,
  };
}

export default useForm;
