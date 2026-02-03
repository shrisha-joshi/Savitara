/**
 * Dynamic Pricing Display Component (Amazon-style)
 * Shows base price, discounts, offers, and savings
 */
import React, { useState, useEffect } from 'react';
import { Box, Typography, Chip, LinearProgress, Tooltip, IconButton } from '@mui/material';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StarsIcon from '@mui/icons-material/Stars';
import MonetizationOnIcon from '@mui/icons-material/MonetizationOn';
import InfoIcon from '@mui/icons-material/Info';
import './PricingDisplay.css';

const PricingDisplay = ({
  baseAmount,
  serviceId = null,
  couponCode = null,
  useCoins = 0,
  onPriceCalculated = null,
  showBreakdown = true
}) => {
  const [priceData, setPriceData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    calculatePrice();
  }, [baseAmount, couponCode, useCoins]);

  const calculatePrice = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/v1/pricing/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          base_amount: baseAmount,
          service_id: serviceId,
          coupon_code: couponCode,
          use_coins: useCoins
        })
      });

      if (response.ok) {
        const data = await response.json();
        setPriceData(data);
        if (onPriceCalculated) {
          onPriceCalculated(data);
        }
      }
    } catch (error) {
      console.error('Price calculation failed:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box className="pricing-container loading">
        <LinearProgress />
        <Typography variant="body2" sx={{ mt: 1 }}>
          Calculating best price...
        </Typography>
      </Box>
    );
  }

  if (!priceData) {
    return null;
  }

  return (
    <Box className="pricing-container">
      {/* Badges Section */}
      {priceData.badges && priceData.badges.length > 0 && (
        <Box className="badges-section">
          {priceData.badges.map((badge, index) => (
            <Chip
              key={index}
              label={badge}
              size="small"
              className={`badge-chip ${getBadgeClass(badge)}`}
              icon={getBadgeIcon(badge)}
            />
          ))}
        </Box>
      )}

      {/* Main Price Display */}
      <Box className="price-main">
        {/* Display Price (Crossed Out) */}
        <Box className="price-original">
          <Typography variant="h6" className="original-price">
            ₹{priceData.display_price.toFixed(2)}
          </Typography>
          <Typography variant="caption" className="original-label">
            M.R.P
          </Typography>
        </Box>

        {/* Final Price (Prominent) */}
        <Box className="price-final">
          <Typography variant="h3" className="final-price">
            ₹{priceData.final_price.toFixed(2)}
          </Typography>
        </Box>

        {/* Savings Badge */}
        <Box className="savings-badge">
          <Typography variant="h6" className="savings-text">
            You Save: ₹{priceData.total_savings.toFixed(2)}
          </Typography>
          <Typography variant="body1" className="savings-percentage">
            ({priceData.savings_percentage.toFixed(0)}% OFF)
          </Typography>
        </Box>
      </Box>

      {/* Discount Breakdown */}
      {showBreakdown && (
        <Box className="price-breakdown">
          <Typography variant="subtitle2" className="breakdown-title">
            Price Breakdown:
          </Typography>
          
          <Box className="breakdown-item">
            <Typography variant="body2">Base Price</Typography>
            <Typography variant="body2" fontWeight="bold">
              ₹{priceData.base_price.toFixed(2)}
            </Typography>
          </Box>

          {priceData.discount_percentage > 0 && (
            <Box className="breakdown-item discount">
              <Typography variant="body2" className="discount-text">
                <LocalOfferIcon fontSize="small" />
                Platform Discount ({priceData.discount_percentage.toFixed(0)}%)
              </Typography>
              <Typography variant="body2" className="discount-amount">
                -₹{((priceData.base_price * priceData.discount_percentage) / 100).toFixed(2)}
              </Typography>
            </Box>
          )}

          {priceData.platform_discount > 0 && (
            <Box className="breakdown-item discount">
              <Typography variant="body2" className="discount-text">
                <StarsIcon fontSize="small" />
                Additional Offers
              </Typography>
              <Typography variant="body2" className="discount-amount">
                -₹{priceData.platform_discount.toFixed(2)}
              </Typography>
            </Box>
          )}

          {priceData.coins_used > 0 && (
            <Box className="breakdown-item discount">
              <Typography variant="body2" className="discount-text">
                <MonetizationOnIcon fontSize="small" />
                Coins Redeemed ({priceData.coins_used})
              </Typography>
              <Typography variant="body2" className="discount-amount">
                -₹{(priceData.coins_used * 0.1).toFixed(2)}
              </Typography>
            </Box>
          )}

          <Box className="breakdown-divider" />

          <Box className="breakdown-item total">
            <Typography variant="subtitle1" fontWeight="bold">
              Total Amount
            </Typography>
            <Typography variant="subtitle1" fontWeight="bold" className="total-amount">
              ₹{priceData.final_price.toFixed(2)}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Urgency Indicators */}
      <Box className="urgency-section">
        <Chip
          label="Limited Time Offer"
          size="small"
          className="urgency-chip"
          icon={<InfoIcon />}
        />
        <Typography variant="caption" className="urgency-text">
          Book now to lock in this price!
        </Typography>
      </Box>

      {/* Applied Offers Info */}
      {(priceData.applied_coupons?.length > 0 || priceData.coins_used > 0) && (
        <Box className="applied-offers">
          <Typography variant="caption" className="offers-title">
            Applied Offers:
          </Typography>
          {priceData.applied_coupons?.map((coupon, index) => (
            <Chip
              key={index}
              label={coupon}
              size="small"
              className="offer-chip"
              onDelete={() => {/* Remove coupon handler */}}
            />
          ))}
          {priceData.coins_used > 0 && (
            <Chip
              label={`${priceData.coins_used} Coins`}
              size="small"
              className="coins-chip"
            />
          )}
        </Box>
      )}

      {/* Social Proof */}
      <Box className="social-proof">
        <Typography variant="caption" className="proof-text">
          ✓ 1,234 users booked at this price today
        </Typography>
      </Box>
    </Box>
  );
};

// Helper Functions
const getBadgeClass = (badge) => {
  if (badge.includes('OFF')) return 'discount-badge';
  if (badge.includes('MEMBER')) return 'loyalty-badge';
  if (badge.includes('COUPON')) return 'coupon-badge';
  if (badge.includes('COINS')) return 'coins-badge';
  return 'default-badge';
};

const getBadgeIcon = (badge) => {
  if (badge.includes('OFF')) return <LocalOfferIcon fontSize="small" />;
  if (badge.includes('MEMBER')) return <StarsIcon fontSize="small" />;
  if (badge.includes('COINS')) return <MonetizationOnIcon fontSize="small" />;
  return null;
};

export default PricingDisplay;
