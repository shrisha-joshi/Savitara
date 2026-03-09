/**
 * SEO Components and Utilities
 * Provides meta tags, Open Graph, JSON-LD Schema markup
 * WCAG 2.1 AA and Google SEO compliant
 */
import PropTypes from 'prop-types';
import React from 'react';

/**
 * Serialize a JSON-LD schema object for safe inline use in <script> tags.
 * Escapes '<', '>' and '&' so the JSON cannot break out of the <script> block
 * (XSS-SEC-01).
 */
const ESC_LT = String.raw`\u003c`;
const ESC_GT = String.raw`\u003e`;
const ESC_AMP = String.raw`\u0026`;

const safeJsonLd = (obj) =>
  JSON.stringify(obj)
    .replaceAll('<', ESC_LT)
    .replaceAll('>', ESC_GT)
    .replaceAll('&', ESC_AMP);

/**
 * SEO Head Component
 * Updates document head with SEO metadata
 * Use in each page component
 */
export const SEOHead = ({
  title,
  description,
  keywords = [],
  canonical,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  noIndex = false,
  author = 'Savitara',
}) => {
  // Full title with site name
  const fullTitle = title ? `${title} | Savitara` : 'Savitara - Connect with Authentic Hindu Traditions';
  
  // Default description
  const metaDescription = description || 
    'Savitara connects Grihastas with verified Acharyas for authentic Hindu spiritual services including Pujas, Havans, and Vedic consultations.';
  
  // Base URL for canonical and OG URLs
  const baseUrl = globalThis.location?.origin || '';
  const canonicalUrl = canonical ? `${baseUrl}${canonical}` : (globalThis.location?.href || '');
  
  // Default OG image
  const ogImageUrl = ogImage || `${baseUrl}/og-image.png`;
  
  React.useEffect(() => {
    // Update document title
    document.title = fullTitle;
    
    // Helper to update meta tag
    const setMeta = (name, content, property = false) => {
      const attr = property ? 'property' : 'name';
      let meta = document.querySelector(`meta[${attr}="${name}"]`);
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute(attr, name);
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', content);
    };
    
    // Basic meta tags
    setMeta('description', metaDescription);
    if (keywords.length > 0) {
      setMeta('keywords', keywords.join(', '));
    }
    setMeta('author', author);
    
    // Robots
    if (noIndex) {
      setMeta('robots', 'noindex, nofollow');
    } else {
      setMeta('robots', 'index, follow');
    }
    
    // Open Graph
    setMeta('og:title', fullTitle, true);
    setMeta('og:description', metaDescription, true);
    setMeta('og:type', ogType, true);
    setMeta('og:url', canonicalUrl, true);
    setMeta('og:image', ogImageUrl, true);
    setMeta('og:site_name', 'Savitara', true);
    setMeta('og:locale', 'en_US', true);
    
    // Twitter Card
    setMeta('twitter:card', twitterCard);
    setMeta('twitter:title', fullTitle);
    setMeta('twitter:description', metaDescription);
    setMeta('twitter:image', ogImageUrl);
    
    // Canonical link
    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.setAttribute('rel', 'canonical');
      document.head.appendChild(link);
    }
    link.setAttribute('href', canonicalUrl);
    
    // Cleanup is not necessary as we're updating existing tags
  }, [fullTitle, metaDescription, keywords, canonicalUrl, ogImageUrl, ogType, twitterCard, noIndex, author]);
  
  return null;
};

SEOHead.propTypes = {
  title: PropTypes.string,
  description: PropTypes.string,
  keywords: PropTypes.arrayOf(PropTypes.string),
  canonical: PropTypes.string,
  ogImage: PropTypes.string,
  ogType: PropTypes.string,
  twitterCard: PropTypes.string,
  noIndex: PropTypes.bool,
  author: PropTypes.string,
};

/**
 * JSON-LD Schema markup for Organization
 */
export const OrganizationSchema = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Savitara',
    url: globalThis.location?.origin || '',
    logo: `${globalThis.location?.origin || ''}/logo.png`,
    description: 'Savitara connects Grihastas with verified Acharyas for authentic Hindu spiritual services.',
    sameAs: [
      'https://www.facebook.com/savitara',
      'https://www.instagram.com/savitara',
      'https://twitter.com/savitara',
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: '+91-1234567890',
      contactType: 'customer service',
      availableLanguage: ['English', 'Hindi', 'Sanskrit', 'Tamil', 'Telugu'],
    },
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

/**
 * JSON-LD Schema for Service (Puja/Havan/etc)
 */
export const ServiceSchema = ({
  name,
  description,
  provider,
  price,
  currency = 'INR',
  duration,
  image,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name,
    description,
    provider: {
      '@type': 'Person',
      name: provider,
    },
    offers: {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability: 'https://schema.org/InStock',
    },
    ...(duration && { duration: `PT${duration}M` }),
    ...(image && { image }),
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

ServiceSchema.propTypes = {
  name: PropTypes.string.isRequired,
  description: PropTypes.string,
  provider: PropTypes.string,
  price: PropTypes.number,
  currency: PropTypes.string,
  duration: PropTypes.number,
  image: PropTypes.string,
};

/**
 * JSON-LD Schema for Person (Acharya profile)
 */
export const PersonSchema = ({
  name,
  description,
  image,
  jobTitle = 'Hindu Priest',
  expertise = [],
  rating,
  reviewCount,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name,
    description,
    jobTitle,
    ...(image && { image }),
    knowsAbout: expertise,
    ...(rating && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating,
        reviewCount,
        bestRating: 5,
        worstRating: 1,
      },
    }),
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

PersonSchema.propTypes = {
  name: PropTypes.string.isRequired,
  description: PropTypes.string,
  image: PropTypes.string,
  jobTitle: PropTypes.string,
  expertise: PropTypes.arrayOf(PropTypes.string),
  rating: PropTypes.number,
  reviewCount: PropTypes.number,
};

/**
 * JSON-LD Schema for BreadcrumbList
 */
export const BreadcrumbSchema = ({ items }) => {
  const origin = globalThis.location?.origin || '';
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${origin}${item.url}`,
    })),
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

BreadcrumbSchema.propTypes = {
  items: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  })).isRequired,
};

/**
 * JSON-LD Schema for FAQ
 */
export const FAQSchema = ({ questions }) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: questions.map(q => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: q.answer,
      },
    })),
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

FAQSchema.propTypes = {
  questions: PropTypes.arrayOf(PropTypes.shape({
    question: PropTypes.string.isRequired,
    answer: PropTypes.string.isRequired,
  })).isRequired,
};

/**
 * JSON-LD Schema for Review
 */
export const ReviewSchema = ({
  itemName,
  itemType = 'Service',
  authorName,
  reviewBody,
  ratingValue,
  datePublished,
}) => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Review',
    itemReviewed: {
      '@type': itemType,
      name: itemName,
    },
    author: {
      '@type': 'Person',
      name: authorName,
    },
    reviewBody,
    reviewRating: {
      '@type': 'Rating',
      ratingValue,
      bestRating: 5,
      worstRating: 1,
    },
    datePublished,
  };
  
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLd(schema) }}
    />
  );
};

ReviewSchema.propTypes = {
  itemName: PropTypes.string.isRequired,
  itemType: PropTypes.string,
  authorName: PropTypes.string.isRequired,
  reviewBody: PropTypes.string.isRequired,
  ratingValue: PropTypes.number.isRequired,
  datePublished: PropTypes.string.isRequired,
};

/**
 * SEO-friendly page wrapper with common elements
 */
export const SEOPage = ({ 
  children, 
  title, 
  description, 
  breadcrumbs = [],
  ...seoProps 
}) => {
  return (
    <>
      <SEOHead title={title} description={description} {...seoProps} />
      <OrganizationSchema />
      {breadcrumbs.length > 0 && <BreadcrumbSchema items={breadcrumbs} />}
      {children}
    </>
  );
};

SEOPage.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  breadcrumbs: PropTypes.arrayOf(PropTypes.shape({
    name: PropTypes.string.isRequired,
    url: PropTypes.string.isRequired,
  })),
};

export default {
  SEOHead,
  OrganizationSchema,
  ServiceSchema,
  PersonSchema,
  BreadcrumbSchema,
  FAQSchema,
  ReviewSchema,
  SEOPage,
};
