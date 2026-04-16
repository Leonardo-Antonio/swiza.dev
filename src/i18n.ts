import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import esTranslation from './locales/es.json';

const resources = {
    en: {
        translation: enTranslation,
    },
    es: {
        translation: esTranslation,
    },
};

// Retrieve saved language from localStorage if available, otherwise default to 'en'
const savedLanguage = localStorage.getItem('app_lang') || 'en';

i18n
    .use(initReactI18next) // passes i18n down to react-i18next
    .init({
        resources,
        lng: savedLanguage,
        fallbackLng: 'en',
        interpolation: {
            escapeValue: false, // react already safes from xss
        },
    });

export default i18n;
