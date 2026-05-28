'use strict';

(function exposeCurrency(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TokenMonitorCurrency = api;
})(typeof window !== 'undefined' ? window : null, function createCurrencyApi() {
  const CURRENCY_RATES = Object.freeze({
    USD: Object.freeze({ code: 'USD', symbol: '$', rate: 1 }),
    TWD: Object.freeze({ code: 'TWD', symbol: 'NT$', rate: 31.5 }),
    HKD: Object.freeze({ code: 'HKD', symbol: 'HK$', rate: 7.8 }),
    CNY: Object.freeze({ code: 'CNY', symbol: '¥', rate: 6.8 })
  });
  const CURRENCY_CODES = Object.freeze(Object.keys(CURRENCY_RATES));

  function normalizeCurrency(value, fallback = 'USD') {
    const code = String(value || '').trim().toUpperCase();
    if (Object.prototype.hasOwnProperty.call(CURRENCY_RATES, code)) return code;
    const fallbackCode = String(fallback || '').trim().toUpperCase();
    return Object.prototype.hasOwnProperty.call(CURRENCY_RATES, fallbackCode) ? fallbackCode : 'USD';
  }

  function convertUsd(value, currency = 'USD') {
    const amount = Number(value || 0);
    const config = CURRENCY_RATES[normalizeCurrency(currency)];
    return Number((amount * config.rate).toFixed(6));
  }

  function fractionDigitsFor(amount, currency) {
    if (normalizeCurrency(currency) === 'USD') return Math.abs(amount) >= 10 ? 2 : 4;
    return Math.abs(amount) >= 1 ? 2 : 4;
  }

  function formatCurrencyFromUsd(value, currency = 'USD') {
    const code = normalizeCurrency(currency);
    const amount = convertUsd(value, code);
    const digits = fractionDigitsFor(amount, code);
    return `${CURRENCY_RATES[code].symbol}${amount.toFixed(digits)}`;
  }

  return {
    CURRENCY_CODES,
    CURRENCY_RATES,
    convertUsd,
    formatCurrencyFromUsd,
    normalizeCurrency
  };
});
