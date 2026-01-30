// src/i18n.js

const DICT = {
  en: {
    nav: {
      organisation: "Organisation",
      kanban: "Kanban Board",
      workitems: "WorkItems",
      dashboard: "Dashboard",
      timeline: "Timeline",
      profile: "Profile",
      settings: "Settings",
    },
    profile: {
      title: "Settings",
      profileTab: "Profile",
      preferencesTab: "Preferences",
      securityTab: "Security",
    },
  },

  zh: {
    nav: {
      organisation: "组织",
      kanban: "看板",
      workitems: "工作项",
      dashboard: "仪表板",
      timeline: "时间线",
      profile: "个人资料",
      settings: "设置",
    },
    profile: {
      title: "设置",
      profileTab: "个人资料",
      preferencesTab: "偏好设置",
      securityTab: "安全",
    },
  },

  ms: {
    nav: {
      organisation: "Organisasi",
      kanban: "Papan Kanban",
      workitems: "Item Kerja",
      dashboard: "Papan Pemuka",
      timeline: "Garis Masa",
      profile: "Profil",
      settings: "Tetapan",
    },
    profile: {
      title: "Tetapan",
      profileTab: "Profil",
      preferencesTab: "Keutamaan",
      securityTab: "Keselamatan",
    },
  },

  ta: {
    nav: {
      organisation: "அமைப்பு",
      kanban: "கன்பன் பலகை",
      workitems: "வேலை உருப்படிகள்",
      dashboard: "டாஷ்போர்டு",
      timeline: "காலவரிசை",
      profile: "சுயவிவரம்",
      settings: "அமைப்புகள்",
    },
    profile: {
      title: "அமைப்புகள்",
      profileTab: "சுயவிவரம்",
      preferencesTab: "விருப்பங்கள்",
      securityTab: "பாதுகாப்பு",
    },
  },
};

function get(obj, path) {
  return path.split(".").reduce((acc, key) => (acc && acc[key] != null ? acc[key] : undefined), obj);
}

export function translate(locale, key) {
  const lang = DICT[locale] ? locale : "en";
  const hit = get(DICT[lang], key);
  if (hit != null) return hit;

  // fallback to English if missing
  const enHit = get(DICT.en, key);
  if (enHit != null) return enHit;

  // fallback to key
  return key;
}
