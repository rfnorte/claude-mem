/* @ds-bundle: {"format":4,"namespace":"PawtencialDesignSystem_c574af","components":[{"name":"Logo","sourcePath":"components/brand/Logo.jsx"},{"name":"Trail","sourcePath":"components/brand/Trail.jsx"},{"name":"TrainerCard","sourcePath":"components/brand/TrainerCard.jsx"},{"name":"Avatar","sourcePath":"components/core/Avatar.jsx"},{"name":"Badge","sourcePath":"components/core/Badge.jsx"},{"name":"Button","sourcePath":"components/core/Button.jsx"},{"name":"Card","sourcePath":"components/core/Card.jsx"},{"name":"Input","sourcePath":"components/core/Input.jsx"},{"name":"Tag","sourcePath":"components/core/Tag.jsx"},{"name":"Banner","sourcePath":"components/feedback/Banner.jsx"},{"name":"EmptyState","sourcePath":"components/feedback/EmptyState.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"AppBar","sourcePath":"components/navigation/AppBar.jsx"},{"name":"TabBar","sourcePath":"components/navigation/TabBar.jsx"}],"sourceHashes":{"components/brand/Logo.jsx":"bb63cad40fe2","components/brand/Trail.jsx":"aa1746359fc7","components/brand/TrainerCard.jsx":"f0ce9da2aad0","components/core/Avatar.jsx":"77cd876cf9cd","components/core/Badge.jsx":"917e36edfb52","components/core/Button.jsx":"68f750332b3c","components/core/Card.jsx":"f7f3ca642c92","components/core/Input.jsx":"fdec854dd54a","components/core/Tag.jsx":"51c41ce80dba","components/feedback/Banner.jsx":"e740719ea07a","components/feedback/EmptyState.jsx":"968a2b77ccec","components/feedback/Toast.jsx":"8aa447f1d22a","components/navigation/AppBar.jsx":"dc2f006b2ef1","components/navigation/TabBar.jsx":"3e56bb849c89","ui_kits/app/BookingScreen.jsx":"6d4b3fc8730a","ui_kits/app/BookingsListScreen.jsx":"6d6cb8e1079a","ui_kits/app/HomeScreen.jsx":"fdbe751e14ab","ui_kits/app/ProfileScreen.jsx":"fb3d6430d304"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.PawtencialDesignSystem_c574af = window.PawtencialDesignSystem_c574af || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/brand/Logo.jsx
try { (() => {
function Logo({
  size = 34,
  on = 'light'
}) {
  const color = on === 'light' ? 'var(--pt-green)' : 'var(--pt-bone)';
  return React.createElement('div', {
    style: {
      display: 'inline-flex',
      alignItems: 'baseline',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: size,
      color,
      letterSpacing: -0.5
    }
  }, 'paw', React.createElement('img', {
    src: '../../assets/paw-mark.svg',
    style: {
      width: '0.8em',
      height: '0.8em',
      alignSelf: 'center',
      margin: '0 0.02em',
      filter: on === 'dark' ? 'brightness(0) invert(1) sepia(1) saturate(4) hue-rotate(340deg)' : 'none'
    }
  }), 'tencial');
}
Object.assign(__ds_scope, { Logo });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Logo.jsx", error: String((e && e.message) || e) }); }

// components/brand/Trail.jsx
try { (() => {
function Trail({
  steps,
  activeIndex
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      fontFamily: 'var(--font-body)'
    }
  }, steps.map((label, i) => {
    const done = i < activeIndex;
    const active = i === activeIndex;
    const dotColor = done ? 'var(--pt-green)' : active ? 'var(--pt-terracotta)' : 'var(--pt-border)';
    return React.createElement('div', {
      key: label,
      style: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        position: 'relative',
        flex: 1
      }
    }, i < steps.length - 1 && React.createElement('div', {
      style: {
        position: 'absolute',
        top: 16,
        left: 'calc(50% + 20px)',
        width: 'calc(100% - 40px)',
        height: 2,
        background: done ? 'var(--pt-green)' : 'var(--pt-border)'
      }
    }), React.createElement('div', {
      style: {
        width: 32,
        height: 32,
        borderRadius: '50%',
        background: dotColor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1,
        boxShadow: active ? '0 0 0 4px rgba(217,119,87,0.18)' : 'none'
      }
    }), React.createElement('div', {
      style: {
        fontSize: 10.5,
        textAlign: 'center',
        color: done ? 'var(--pt-green)' : active ? 'var(--pt-terracotta)' : 'var(--pt-text-40)',
        fontWeight: active ? 700 : 400,
        maxWidth: 70
      }
    }, label));
  }));
}
Object.assign(__ds_scope, { Trail });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/Trail.jsx", error: String((e && e.message) || e) }); }

// components/core/Avatar.jsx
try { (() => {
const SIZES = {
  xs: 32,
  sm: 40,
  md: 56,
  lg: 88
};
const FONT = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 28
};
function Avatar({
  initials,
  size = 'md'
}) {
  const px = SIZES[size];
  return React.createElement('div', {
    style: {
      width: px,
      height: px,
      borderRadius: '50%',
      background: 'var(--pt-sand)',
      color: 'var(--pt-green)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: FONT[size]
    }
  }, initials);
}
Object.assign(__ds_scope, { Avatar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Avatar.jsx", error: String((e && e.message) || e) }); }

// components/core/Badge.jsx
try { (() => {
const TONES = {
  proibido: {
    background: 'var(--pt-danger-bg)',
    color: 'var(--pt-danger)'
  },
  condicional: {
    background: 'var(--pt-warning-bg)',
    color: 'var(--pt-warning-text)'
  },
  livre: {
    background: 'var(--pt-success-bg)',
    color: 'var(--pt-green-dark)'
  }
};
const LABELS = {
  proibido: 'Proibido',
  condicional: 'Condicional',
  livre: 'Livre'
};
function Badge({
  level = 'livre',
  size = 'md'
}) {
  const dot = size === 'sm' ? 5 : 7;
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: size === 'sm' ? '3px 10px' : '6px 13px',
      borderRadius: 'var(--r-full)',
      fontFamily: 'var(--font-body)',
      fontSize: size === 'sm' ? 10.5 : 12,
      fontWeight: 700,
      ...TONES[level]
    }
  }, React.createElement('span', {
    style: {
      width: dot,
      height: dot,
      borderRadius: '50%',
      background: 'currentColor'
    }
  }), LABELS[level]);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Badge.jsx", error: String((e && e.message) || e) }); }

// components/core/Button.jsx
try { (() => {
function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  children,
  onClick,
  style
}) {
  const base = {
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    border: 'none',
    cursor: disabled ? 'not-allowed' : 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--r-md)',
    transition: 'opacity .15s',
    opacity: disabled ? 0.35 : 1
  };
  const sizes = {
    lg: {
      width: '100%',
      padding: '16px 24px',
      fontSize: 15
    },
    md: {
      padding: '14px 22px',
      fontSize: 14
    },
    sm: {
      padding: '9px 16px',
      fontSize: 13,
      borderRadius: 'var(--r-sm)'
    }
  };
  const variants = {
    primary: {
      background: 'var(--pt-terracotta)',
      color: 'var(--pt-bone)'
    },
    secondary: {
      background: 'transparent',
      color: 'var(--pt-green)',
      border: '1.5px solid var(--pt-green)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--pt-green)',
      fontWeight: 500,
      padding: '4px'
    }
  };
  return React.createElement('button', {
    disabled,
    onClick,
    style: {
      ...base,
      ...sizes[size],
      ...variants[variant],
      ...style
    },
    onMouseEnter: e => {
      if (!disabled && variant === 'primary') e.currentTarget.style.opacity = 0.9;
    },
    onMouseLeave: e => {
      if (!disabled) e.currentTarget.style.opacity = 1;
    }
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Button.jsx", error: String((e && e.message) || e) }); }

// components/core/Card.jsx
try { (() => {
function Card({
  children,
  style
}) {
  return React.createElement('div', {
    style: {
      background: 'white',
      borderRadius: 'var(--r-lg)',
      padding: 20,
      boxShadow: 'var(--sh-sm)',
      ...style
    }
  }, children);
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Card.jsx", error: String((e && e.message) || e) }); }

// components/core/Input.jsx
try { (() => {
function Input({
  label,
  placeholder,
  value,
  state = 'default',
  helper,
  disabled = false,
  onChange
}) {
  const borderColor = state === 'error' ? 'var(--pt-danger)' : state === 'focus' ? 'var(--pt-green)' : 'var(--pt-border)';
  const boxShadow = state === 'focus' ? '0 0 0 3px rgba(74,103,65,0.12)' : 'none';
  return React.createElement('div', {
    style: {
      marginBottom: 16,
      fontFamily: 'var(--font-body)'
    }
  }, label && React.createElement('label', {
    style: {
      fontSize: 12,
      fontWeight: 700,
      color: 'var(--pt-green-dark)',
      marginBottom: 6,
      display: 'block'
    }
  }, label), React.createElement('input', {
    placeholder,
    value,
    disabled,
    onChange,
    style: {
      width: '100%',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: 'var(--pt-text)',
      background: disabled ? '#F2EFE9' : 'white',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 'var(--r-md)',
      padding: '13px 14px',
      outline: 'none',
      boxShadow,
      boxSizing: 'border-box'
    }
  }), helper && React.createElement('div', {
    style: {
      fontSize: 11.5,
      marginTop: 5,
      color: state === 'error' ? 'var(--pt-danger)' : 'var(--pt-text-40)'
    }
  }, helper));
}
Object.assign(__ds_scope, { Input });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Input.jsx", error: String((e && e.message) || e) }); }

// components/core/Tag.jsx
try { (() => {
function Tag({
  children,
  tone = 'sand'
}) {
  const tones = {
    sand: {
      background: 'var(--pt-sand)',
      color: 'var(--pt-green-dark)'
    },
    green: {
      background: 'var(--pt-green)',
      color: 'var(--pt-bone)'
    }
  };
  return React.createElement('span', {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 12px',
      borderRadius: 'var(--r-full)',
      fontFamily: 'var(--font-body)',
      fontSize: 11.5,
      fontWeight: 500,
      ...tones[tone]
    }
  }, children);
}
Object.assign(__ds_scope, { Tag });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/core/Tag.jsx", error: String((e && e.message) || e) }); }

// components/brand/TrainerCard.jsx
try { (() => {
function TrainerCard({
  initials,
  name,
  meta,
  rating,
  reviews,
  tags = [],
  safetyLevel,
  compact = false
}) {
  return React.createElement('div', {
    style: {
      background: 'white',
      borderRadius: 'var(--r-lg)',
      padding: 20,
      boxShadow: 'var(--sh-sm)',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      maxWidth: 380,
      fontFamily: 'var(--font-body)'
    }
  }, React.createElement(__ds_scope.Avatar, {
    initials,
    size: compact ? 'sm' : 'md'
  }), React.createElement('div', {
    style: {
      flex: 1
    }
  }, React.createElement('div', {
    style: {
      fontWeight: 700,
      fontSize: compact ? 13 : 14.5,
      marginBottom: 2
    }
  }, name), React.createElement('div', {
    style: {
      fontSize: 12,
      color: 'var(--pt-text-60)',
      marginBottom: 6
    }
  }, meta), React.createElement('div', {
    style: {
      color: 'var(--pt-terracotta)',
      fontSize: compact ? 12 : 13,
      fontWeight: 500
    }
  }, `★ ${rating} `, React.createElement('span', {
    style: {
      color: 'var(--pt-text-40)',
      fontWeight: 400
    }
  }, `· ${reviews} avaliações`)), !compact && (tags.length > 0 || safetyLevel) && React.createElement('div', {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap',
      marginTop: 10
    }
  }, tags.map(t => React.createElement(__ds_scope.Tag, {
    key: t
  }, t)), safetyLevel && React.createElement(__ds_scope.Badge, {
    level: safetyLevel,
    size: 'sm'
  }))));
}
Object.assign(__ds_scope, { TrainerCard });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/brand/TrainerCard.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Banner.jsx
try { (() => {
const TONES = {
  success: {
    background: 'var(--pt-success-bg)',
    color: 'var(--pt-green-dark)',
    dot: 'var(--pt-green)'
  },
  warning: {
    background: 'var(--pt-warning-bg)',
    color: 'var(--pt-warning-text)',
    dot: 'var(--pt-terracotta)'
  },
  danger: {
    background: 'var(--pt-danger-bg)',
    color: 'var(--pt-danger)',
    dot: 'var(--pt-danger)'
  },
  info: {
    background: 'var(--pt-info-bg)',
    color: 'var(--pt-info)',
    dot: 'var(--pt-info)'
  }
};
function Banner({
  tone = 'info',
  children
}) {
  const t = TONES[tone];
  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      padding: '14px 16px',
      borderRadius: 'var(--r-md)',
      fontFamily: 'var(--font-body)',
      fontSize: 13,
      alignItems: 'flex-start',
      background: t.background,
      color: t.color
    }
  }, React.createElement('div', {
    style: {
      width: 8,
      height: 8,
      borderRadius: '50%',
      marginTop: 5,
      flexShrink: 0,
      background: t.dot
    }
  }), children);
}
Object.assign(__ds_scope, { Banner });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Banner.jsx", error: String((e && e.message) || e) }); }

// components/feedback/EmptyState.jsx
try { (() => {
function EmptyState({
  heading,
  text,
  actionLabel,
  onAction
}) {
  return React.createElement('div', {
    style: {
      background: 'white',
      borderRadius: 'var(--r-lg)',
      boxShadow: 'var(--sh-sm)',
      textAlign: 'center',
      padding: '48px 24px',
      fontFamily: 'var(--font-body)',
      maxWidth: 360
    }
  }, React.createElement('div', {
    style: {
      width: 56,
      height: 56,
      borderRadius: '50%',
      background: 'var(--pt-sand)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 18px'
    }
  }, React.createElement('img', {
    src: '../../assets/paw-mark-simple.svg',
    style: {
      width: 26,
      height: 26
    }
  })), React.createElement('h4', {
    style: {
      fontFamily: 'var(--font-display)',
      fontSize: 18,
      color: 'var(--pt-green)',
      margin: '0 0 6px',
      fontWeight: 600
    }
  }, heading), React.createElement('p', {
    style: {
      fontSize: 13,
      color: 'var(--pt-text-60)',
      maxWidth: '32ch',
      margin: '0 auto 20px'
    }
  }, text), actionLabel && React.createElement('button', {
    onClick: onAction,
    style: {
      fontFamily: 'var(--font-body)',
      fontWeight: 700,
      fontSize: 13,
      border: 'none',
      cursor: 'pointer',
      background: 'var(--pt-terracotta)',
      color: 'var(--pt-bone)',
      borderRadius: 'var(--r-sm)',
      padding: '9px 16px'
    }
  }, actionLabel));
}
Object.assign(__ds_scope, { EmptyState });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/EmptyState.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
function Toast({
  title = 'Pawtencial',
  text
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      gap: 12,
      alignItems: 'flex-start',
      background: 'white',
      borderRadius: 'var(--r-lg)',
      padding: 14,
      boxShadow: 'var(--sh-md)',
      maxWidth: 340,
      fontFamily: 'var(--font-body)'
    }
  }, React.createElement('div', {
    style: {
      width: 36,
      height: 36,
      borderRadius: 'var(--r-sm)',
      background: 'var(--pt-green)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0
    }
  }, React.createElement('img', {
    src: '../../assets/paw-mark-simple.svg',
    style: {
      width: 20,
      height: 20,
      filter: 'brightness(0) invert(1)'
    }
  })), React.createElement('div', null, React.createElement('div', {
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      marginBottom: 2
    }
  }, title), React.createElement('div', {
    style: {
      fontSize: 12,
      color: 'var(--pt-text-60)'
    }
  }, text)));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/navigation/AppBar.jsx
try { (() => {
function AppBar({
  actionSlot
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: 'var(--pt-bone)',
      borderBottom: '1px solid var(--pt-border)',
      padding: '14px 18px',
      fontFamily: 'var(--font-body)'
    }
  }, React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 17,
      color: 'var(--pt-green)'
    }
  }, 'paw', React.createElement('img', {
    src: '../../assets/paw-mark-simple.svg',
    style: {
      width: '0.8em',
      height: '0.8em',
      alignSelf: 'center',
      margin: '0 0.02em'
    }
  }), 'tencial'), actionSlot || React.createElement('div', {
    style: {
      width: 34,
      height: 34,
      borderRadius: '50%',
      background: 'var(--pt-sand)'
    }
  }));
}
Object.assign(__ds_scope, { AppBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/AppBar.jsx", error: String((e && e.message) || e) }); }

// components/navigation/TabBar.jsx
try { (() => {
function TabBar({
  items,
  active,
  onItemClick
}) {
  return React.createElement('div', {
    style: {
      display: 'flex',
      background: 'white',
      borderTop: '1px solid var(--pt-border)',
      padding: '10px 8px 14px',
      fontFamily: 'var(--font-body)'
    }
  }, items.map((item, i) => {
    const isActive = i === active;
    return React.createElement('div', {
      key: item,
      onClick: onItemClick ? () => onItemClick(i) : undefined,
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 5,
        fontSize: 10,
        color: isActive ? 'var(--pt-terracotta)' : 'var(--pt-text-40)',
        fontWeight: isActive ? 700 : 400,
        cursor: onItemClick ? 'pointer' : 'default'
      }
    }, React.createElement('div', {
      style: {
        width: 20,
        height: 20,
        borderRadius: 6,
        background: 'currentColor',
        opacity: isActive ? 1 : 0.18
      }
    }), item);
  }));
}
Object.assign(__ds_scope, { TabBar });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/TabBar.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/BookingScreen.jsx
try { (() => {
function BookingScreen({
  trainer,
  onDone
}) {
  const {
    Banner,
    Button,
    Trail
  } = window.PawtencialDesignSystem_c574af;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 20,
      color: 'var(--pt-green)'
    }
  }, "Sess\xE3o confirmada"), /*#__PURE__*/React.createElement(Banner, {
    tone: "success"
  }, "Sess\xE3o confirmada com a ", trainer.name, " para amanh\xE3 \xE0s 10h."), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: 1,
      color: 'var(--pt-green-dark)',
      marginBottom: 14
    }
  }, "O Trilho de Bolinha"), /*#__PURE__*/React.createElement(Trail, {
    steps: ["Primeiras Pegadas", "Lado a Lado", "Superação", "Exploração", "Pawtencial"],
    activeIndex: 2
  })), /*#__PURE__*/React.createElement(Button, {
    variant: "secondary",
    onClick: onDone
  }, "Voltar ao in\xEDcio"));
}
window.BookingScreen = BookingScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/BookingScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/BookingsListScreen.jsx
try { (() => {
function BookingsListScreen({
  hasBookings,
  onFindTrainer
}) {
  const {
    EmptyState,
    Card,
    Avatar
  } = window.PawtencialDesignSystem_c574af;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      alignSelf: 'flex-start',
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 20,
      color: 'var(--pt-green)'
    }
  }, "Marca\xE7\xF5es"), hasBookings ? /*#__PURE__*/React.createElement(Card, {
    style: {
      width: '100%',
      display: 'flex',
      gap: 12,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: "MS",
    size: "sm"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontWeight: 700,
      fontSize: 13.5
    }
  }, "Marta Sousa"), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--pt-text-60)'
    }
  }, "Amanh\xE3 \xB7 10h00"))) : /*#__PURE__*/React.createElement(EmptyState, {
    heading: "Ainda n\xE3o tens sess\xF5es",
    text: "Quando marcares a tua primeira sess\xE3o, ela aparece aqui.",
    actionLabel: "Procurar treinador",
    onAction: onFindTrainer
  }));
}
window.BookingsListScreen = BookingsListScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/BookingsListScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/HomeScreen.jsx
try { (() => {
function HomeScreen({
  trainers,
  onSelect
}) {
  const {
    Input,
    Tag,
    TrainerCard
  } = window.PawtencialDesignSystem_c574af;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 22,
      color: 'var(--pt-green)'
    }
  }, "Ol\xE1, Rui"), /*#__PURE__*/React.createElement(Input, {
    placeholder: "Procurar por zona ou especialidade"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement(Tag, {
    tone: "green"
  }, "Perto de mim"), /*#__PURE__*/React.createElement(Tag, null, "Reativos"), /*#__PURE__*/React.createElement(Tag, null, "Filhotes")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, trainers.map(t => /*#__PURE__*/React.createElement("div", {
    key: t.initials,
    onClick: () => onSelect(t),
    style: {
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement(TrainerCard, t)))));
}
window.HomeScreen = HomeScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/HomeScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/app/ProfileScreen.jsx
try { (() => {
function ProfileScreen({
  trainer,
  onBack,
  onBook
}) {
  const {
    Avatar,
    Tag,
    Banner,
    Button
  } = window.PawtencialDesignSystem_c574af;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: onBack,
    style: {
      fontSize: 12,
      color: 'var(--pt-green)',
      cursor: 'pointer',
      fontWeight: 700
    }
  }, "\u2190 Voltar"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement(Avatar, {
    initials: trainer.initials,
    size: "lg"
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 600,
      fontSize: 19,
      color: 'var(--pt-green)'
    }
  }, trainer.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 11.5,
      color: 'var(--pt-text-40)'
    }
  }, "Treinadora certificada \xB7 8 anos"), /*#__PURE__*/React.createElement("div", {
    style: {
      color: 'var(--pt-terracotta)',
      fontSize: 13,
      marginTop: 4
    }
  }, "\u2605 ", trainer.rating, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--pt-text-40)'
    }
  }, "\xB7 ", trainer.reviews, " avalia\xE7\xF5es")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, trainer.tags.map(t => /*#__PURE__*/React.createElement(Tag, {
    key: t
  }, t))), /*#__PURE__*/React.createElement(Banner, {
    tone: "success"
  }, "M\xE9todos e instrumentos: s\xF3 refor\xE7o positivo \u2014 nenhum instrumento condicional ou proibido."), /*#__PURE__*/React.createElement(Button, {
    variant: "primary",
    size: "lg",
    onClick: onBook
  }, "Reservar sess\xE3o \xB7 45\u20AC"));
}
window.ProfileScreen = ProfileScreen;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/app/ProfileScreen.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Logo = __ds_scope.Logo;

__ds_ns.Trail = __ds_scope.Trail;

__ds_ns.TrainerCard = __ds_scope.TrainerCard;

__ds_ns.Avatar = __ds_scope.Avatar;

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.Input = __ds_scope.Input;

__ds_ns.Tag = __ds_scope.Tag;

__ds_ns.Banner = __ds_scope.Banner;

__ds_ns.EmptyState = __ds_scope.EmptyState;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.AppBar = __ds_scope.AppBar;

__ds_ns.TabBar = __ds_scope.TabBar;

})();
