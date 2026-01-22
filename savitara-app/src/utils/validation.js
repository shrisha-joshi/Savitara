/**
 * Form Validation Schemas and Utilities
 * Provides consistent validation across mobile and web apps
 * Uses Yup-like validation patterns
 */

// Validation error messages (i18n ready)
export const VALIDATION_MESSAGES = {
  required: (field) => `${field} is required`,
  email: 'Please enter a valid email address',
  phone: 'Please enter a valid phone number',
  minLength: (field, min) => `${field} must be at least ${min} characters`,
  maxLength: (field, max) => `${field} must be at most ${max} characters`,
  min: (field, min) => `${field} must be at least ${min}`,
  max: (field, max) => `${field} must be at most ${max}`,
  pattern: (field) => `${field} format is invalid`,
  match: (field1, field2) => `${field1} must match ${field2}`,
  date: 'Please enter a valid date',
  futureDate: 'Date must be in the future',
  pastDate: 'Date must be in the past',
  url: 'Please enter a valid URL',
  pincode: 'Please enter a valid 6-digit pincode',
  aadhaar: 'Please enter a valid 12-digit Aadhaar number',
  pan: 'Please enter a valid PAN number',
  numeric: (field) => `${field} must be a number`,
  integer: (field) => `${field} must be a whole number`,
  positive: (field) => `${field} must be positive`,
};

/**
 * Validator class for chainable validation
 */
class Validator {
  constructor() {
    this.rules = [];
    this.fieldName = 'Field';
  }

  label(name) {
    this.fieldName = name;
    return this;
  }

  required(message) {
    this.rules.push({
      test: (value) => value !== undefined && value !== null && value !== '',
      message: message || VALIDATION_MESSAGES.required(this.fieldName),
    });
    return this;
  }

  email(message) {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
    this.rules.push({
      test: (value) => !value || emailRegex.test(value),
      message: message || VALIDATION_MESSAGES.email,
    });
    return this;
  }

  phone(message) {
    const phoneRegex = /^[+]?[\d\s()-]{10,15}$/;
    this.rules.push({
      test: (value) => !value || phoneRegex.test(value.replaceAll(/\s/g, '')),
      message: message || VALIDATION_MESSAGES.phone,
    });
    return this;
  }

  minLength(min, message) {
    this.rules.push({
      test: (value) => !value || value.length >= min,
      message: message || VALIDATION_MESSAGES.minLength(this.fieldName, min),
    });
    return this;
  }

  maxLength(max, message) {
    this.rules.push({
      test: (value) => !value || value.length <= max,
      message: message || VALIDATION_MESSAGES.maxLength(this.fieldName, max),
    });
    return this;
  }

  min(minValue, message) {
    this.rules.push({
      test: (value) => value === '' || value === null || Number(value) >= minValue,
      message: message || VALIDATION_MESSAGES.min(this.fieldName, minValue),
    });
    return this;
  }

  max(maxValue, message) {
    this.rules.push({
      test: (value) => value === '' || value === null || Number(value) <= maxValue,
      message: message || VALIDATION_MESSAGES.max(this.fieldName, maxValue),
    });
    return this;
  }

  pattern(regex, message) {
    this.rules.push({
      test: (value) => !value || regex.test(value),
      message: message || VALIDATION_MESSAGES.pattern(this.fieldName),
    });
    return this;
  }

  matches(field, fieldName, message) {
    this.rules.push({
      test: (value, formValues) => !value || value === formValues[field],
      message: message || VALIDATION_MESSAGES.match(this.fieldName, fieldName),
    });
    return this;
  }

  url(message) {
    const urlRegex = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]+)*\/?$/;
    this.rules.push({
      test: (value) => !value || urlRegex.test(value),
      message: message || VALIDATION_MESSAGES.url,
    });
    return this;
  }

  date(message) {
    this.rules.push({
      test: (value) => !value || !Number.isNaN(new Date(value).getTime()),
      message: message || VALIDATION_MESSAGES.date,
    });
    return this;
  }

  futureDate(message) {
    this.rules.push({
      test: (value) => !value || new Date(value) > new Date(),
      message: message || VALIDATION_MESSAGES.futureDate,
    });
    return this;
  }

  pastDate(message) {
    this.rules.push({
      test: (value) => !value || new Date(value) < new Date(),
      message: message || VALIDATION_MESSAGES.pastDate,
    });
    return this;
  }

  pincode(message) {
    this.rules.push({
      test: (value) => !value || /^\d{6}$/.test(value),
      message: message || VALIDATION_MESSAGES.pincode,
    });
    return this;
  }

  aadhaar(message) {
    this.rules.push({
      test: (value) => !value || /^\d{12}$/.test(value.replaceAll(/\s/g, '')),
      message: message || VALIDATION_MESSAGES.aadhaar,
    });
    return this;
  }

  pan(message) {
    this.rules.push({
      test: (value) => !value || /^[A-Z]{5}\d{4}[A-Z]$/.test(value.toUpperCase()),
      message: message || VALIDATION_MESSAGES.pan,
    });
    return this;
  }

  numeric(message) {
    this.rules.push({
      test: (value) => value === '' || value === null || !Number.isNaN(Number(value)),
      message: message || VALIDATION_MESSAGES.numeric(this.fieldName),
    });
    return this;
  }

  integer(message) {
    this.rules.push({
      test: (value) => value === '' || value === null || Number.isInteger(Number(value)),
      message: message || VALIDATION_MESSAGES.integer(this.fieldName),
    });
    return this;
  }

  positive(message) {
    this.rules.push({
      test: (value) => value === '' || value === null || Number(value) > 0,
      message: message || VALIDATION_MESSAGES.positive(this.fieldName),
    });
    return this;
  }

  custom(testFn, message) {
    this.rules.push({
      test: testFn,
      message,
    });
    return this;
  }

  validate(value, formValues = {}) {
    for (const rule of this.rules) {
      if (!rule.test(value, formValues)) {
        return rule.message;
      }
    }
    return null;
  }
}

/**
 * Create a new validator chain
 */
export const string = () => new Validator();
export const number = () => new Validator().numeric();

/**
 * Schema class for form-wide validation
 */
class ValidationSchema {
  constructor(shape) {
    this.shape = shape;
  }

  validate(values) {
    const errors = {};
    let isValid = true;

    for (const [field, validator] of Object.entries(this.shape)) {
      const error = validator.validate(values[field], values);
      if (error) {
        errors[field] = error;
        isValid = false;
      }
    }

    return { isValid, errors };
  }

  validateField(field, value, allValues = {}) {
    const validator = this.shape[field];
    if (!validator) return null;
    return validator.validate(value, allValues);
  }
}

/**
 * Create a validation schema
 */
export const createSchema = (shape) => new ValidationSchema(shape);

// ===========================================
// Pre-defined schemas for Savitara
// ===========================================

/**
 * Login form validation schema
 */
export const loginSchema = createSchema({
  email: string().label('Email').required().email(),
  password: string().label('Password').required().minLength(8),
});

/**
 * Registration form validation schema
 */
export const registrationSchema = createSchema({
  name: string().label('Full Name').required().minLength(2).maxLength(100),
  email: string().label('Email').required().email(),
  password: string()
    .label('Password')
    .required()
    .minLength(8)
    .pattern(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain uppercase, lowercase, and number'
    ),
  confirmPassword: string()
    .label('Confirm Password')
    .required()
    .matches('password', 'Password'),
  phone: string().label('Phone Number').phone(),
});

/**
 * Grihasta profile validation schema
 */
export const grihastaProfileSchema = createSchema({
  name: string().label('Name').required().minLength(2).maxLength(100),
  phone: string().label('Phone').required().phone(),
  gotra: string().label('Gotra'),
  nakshatra: string().label('Nakshatra'),
  rashi: string().label('Rashi'),
  address_line1: string().label('Address').required().minLength(5),
  city: string().label('City').required(),
  state: string().label('State').required(),
  pincode: string().label('Pincode').required().pincode(),
});

/**
 * Acharya profile validation schema
 */
export const acharyaProfileSchema = createSchema({
  name: string().label('Name').required().minLength(2).maxLength(100),
  phone: string().label('Phone').required().phone(),
  bio: string().label('Bio').required().minLength(50).maxLength(1000),
  experience_years: number().label('Experience').required().min(0).max(80),
  hourly_rate: number().label('Hourly Rate').required().min(100).positive(),
  languages: string()
    .label('Languages')
    .required()
    .custom((value) => value && value.length > 0, 'Select at least one language'),
  specializations: string()
    .label('Specializations')
    .required()
    .custom((value) => value && value.length > 0, 'Select at least one specialization'),
  aadhaar_number: string().label('Aadhaar Number').aadhaar(),
  pan_number: string().label('PAN Number').pan(),
});

/**
 * Booking form validation schema
 */
export const bookingSchema = createSchema({
  service_type: string().label('Service Type').required(),
  date: string().label('Date').required().date().futureDate(),
  time_slot: string().label('Time Slot').required(),
  duration: number().label('Duration').required().min(30).max(480),
  special_requirements: string().label('Special Requirements').maxLength(500),
  address_line1: string().label('Address').required().minLength(5),
  city: string().label('City').required(),
  pincode: string().label('Pincode').required().pincode(),
});

/**
 * Review form validation schema
 */
export const reviewSchema = createSchema({
  rating: number().label('Rating').required().min(1).max(5),
  comment: string().label('Review').required().minLength(20).maxLength(1000),
});

/**
 * Payment form validation schema
 */
export const paymentSchema = createSchema({
  amount: number().label('Amount').required().positive(),
  card_number: string()
    .label('Card Number')
    .pattern(/^\d{16}$/, 'Please enter a valid 16-digit card number'),
  expiry: string()
    .label('Expiry Date')
    .pattern(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Please enter expiry in MM/YY format'),
  cvv: string()
    .label('CVV')
    .pattern(/^\d{3,4}$/, 'Please enter a valid CVV'),
});

/**
 * Contact form validation schema
 */
export const contactSchema = createSchema({
  name: string().label('Name').required().minLength(2),
  email: string().label('Email').required().email(),
  subject: string().label('Subject').required().minLength(5).maxLength(200),
  message: string().label('Message').required().minLength(20).maxLength(2000),
});

export default {
  string,
  number,
  createSchema,
  loginSchema,
  registrationSchema,
  grihastaProfileSchema,
  acharyaProfileSchema,
  bookingSchema,
  reviewSchema,
  paymentSchema,
  contactSchema,
  VALIDATION_MESSAGES,
};
