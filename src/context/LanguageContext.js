import React, { createContext, useState, useContext, useEffect } from 'react';
import i18n from '../i18n';

const LanguageContext = createContext();

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguageState] = useState(
    () => localStorage.getItem('language') || 'en'
  );

  const isRTL = language === 'ar';

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir  = isRTL ? 'rtl' : 'ltr';
    document.body.classList.toggle('rtl', isRTL);
  }, [language, isRTL]);

  const setLanguage = (lang) => {
    localStorage.setItem('language', lang);
    i18n.changeLanguage(lang);
    setLanguageState(lang);
  };

  const t = (key) => {
    // key like "nav.dashboard" or "common.save"
    return i18n.t(key);
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, isRTL, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

