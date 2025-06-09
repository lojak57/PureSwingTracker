# Pure Golf Design System
## "Pastel Packers" • Augusta Clubhouse • Glassmorphic Modern

*A comprehensive design language for the Pure Golf swing analysis platform*

---

## 🎨 **Color Palette**

### **Primary Colors (Pastel Packers)**
```css
/* Forest Green Pastels */
--sage-50:     #f8faf9    /* Whisper sage */
--sage-100:    #e8f2ed    /* Light sage mist */
--sage-200:    #d1e7d8    /* Soft sage */
--sage-300:    #a8d4b8    /* Medium sage */
--sage-400:    #7fb894    /* True sage */
--sage-500:    #5a9b6f    /* Deep sage */
--sage-600:    #4a7f5c    /* Forest sage */
--sage-700:    #3d6649    /* Dark forest */
--sage-800:    #2f4d37    /* Charcoal green */
--sage-900:    #203731    /* Packers forest */

/* Champagne Gold Pastels */
--gold-50:     #fffef7    /* Cream white */
--gold-100:    #fefaeb    /* Warm cream */
--gold-200:    #fdf4d3    /* Light champagne */
--gold-300:    #fbea9f    /* Soft gold */
--gold-400:    #f7dc6b    /* Medium gold */
--gold-500:    #f2cd37    /* True gold */
--gold-600:    #e6b91a    /* Rich gold */
--gold-700:    #c19d16    /* Deep gold */
--gold-800:    #9c7f15    /* Antique gold */
--gold-900:    #FFB612    /* Packers gold */
```

### **Neutral Palette (Augusta Whites & Grays)**
```css
/* Augusta Whites */
--augusta-50:   #ffffff    /* Pure white */
--augusta-100:  #fefefe    /* Off white */
--augusta-200:  #fafafa    /* Lightest gray */
--augusta-300:  #f5f5f5    /* Light gray */
--augusta-400:  #e5e5e5    /* Medium light gray */
--augusta-500:  #d4d4d4    /* Medium gray */
--augusta-600:  #a3a3a3    /* Medium dark gray */
--augusta-700:  #737373    /* Dark gray */
--augusta-800:  #525252    /* Charcoal */
--augusta-900:  #262626    /* Near black */

/* Glass Overlay Colors */
--glass-white:  rgba(255, 255, 255, 0.25)
--glass-sage:   rgba(122, 184, 148, 0.15)
--glass-gold:   rgba(242, 205, 55, 0.12)
--glass-dark:   rgba(32, 55, 49, 0.08)
```

### **Semantic Colors**
```css
/* Status Colors */
--success-light: #ecfdf5   /* Success background */
--success:       #10b981   /* Success primary */
--success-dark:  #047857   /* Success dark */

--warning-light: #fffbeb   /* Warning background */
--warning:       #f59e0b   /* Warning primary */
--warning-dark:  #d97706   /* Warning dark */

--error-light:   #fef2f2   /* Error background */
--error:         #ef4444   /* Error primary */
--error-dark:    #dc2626   /* Error dark */

--info-light:    #f0f9ff   /* Info background */
--info:          #3b82f6   /* Info primary */
--info-dark:     #1d4ed8   /* Info dark */
```

---

## 📝 **Typography**

### **Font Families**
```css
/* Primary: Modern serif for elegance */
--font-serif:    'Crimson Text', 'Georgia', serif;

/* Secondary: Clean sans-serif for UI */
--font-sans:     'Inter', 'Helvetica Neue', sans-serif;

/* Monospace: Code and data */
--font-mono:     'JetBrains Mono', 'Menlo', monospace;

/* Display: Headings and hero text */
--font-display:  'Playfair Display', 'Times New Roman', serif;
```

### **Typography Scale**
```css
/* Display Typography (Hero sections) */
--text-display-xl: 4.5rem    /* 72px - Hero titles */
--text-display-lg: 3.75rem   /* 60px - Page heroes */
--text-display-md: 3rem      /* 48px - Section headers */
--text-display-sm: 2.25rem   /* 36px - Card titles */

/* Heading Typography */
--text-h1: 2rem              /* 32px - Main headings */
--text-h2: 1.5rem            /* 24px - Sub headings */
--text-h3: 1.25rem           /* 20px - Card headings */
--text-h4: 1.125rem          /* 18px - Component titles */

/* Body Typography */
--text-lg: 1.125rem          /* 18px - Large body */
--text-base: 1rem            /* 16px - Base body */
--text-sm: 0.875rem          /* 14px - Small text */
--text-xs: 0.75rem           /* 12px - Captions */
```

### **Typography Hierarchy**
- **Display Text**: Playfair Display, gold accent color, used for hero sections
- **Headings**: Crimson Text, sage-800, elegant serif for section headers
- **Body Text**: Inter, augusta-700, clean and readable
- **UI Elements**: Inter, various weights for buttons, labels, navigation
- **Captions/Meta**: Inter, augusta-500, subtle supporting text

---

## 🎭 **Glassmorphic Design Language**

### **Glass Surfaces**
```css
/* Primary Glass Card */
.glass-card {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  box-shadow: 
    0 8px 32px rgba(32, 55, 49, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.3);
}

/* Sage Glass Overlay */
.glass-sage {
  background: rgba(122, 184, 148, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(122, 184, 148, 0.25);
}

/* Gold Glass Accent */
.glass-gold {
  background: rgba(242, 205, 55, 0.12);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(242, 205, 55, 0.3);
}

/* Navigation Glass */
.glass-nav {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
}
```

### **Depth & Shadows**
```css
/* Elevation System */
--shadow-xs:  0 1px 2px rgba(32, 55, 49, 0.05);
--shadow-sm:  0 1px 3px rgba(32, 55, 49, 0.1), 0 1px 2px rgba(32, 55, 49, 0.06);
--shadow-md:  0 4px 6px rgba(32, 55, 49, 0.07), 0 2px 4px rgba(32, 55, 49, 0.06);
--shadow-lg:  0 10px 15px rgba(32, 55, 49, 0.1), 0 4px 6px rgba(32, 55, 49, 0.05);
--shadow-xl:  0 20px 25px rgba(32, 55, 49, 0.1), 0 10px 10px rgba(32, 55, 49, 0.04);
--shadow-2xl: 0 25px 50px rgba(32, 55, 49, 0.15);

/* Glass Inner Glow */
--glow-inner: inset 0 1px 0 rgba(255, 255, 255, 0.3);
--glow-gold:  inset 0 1px 0 rgba(242, 205, 55, 0.4);
--glow-sage:  inset 0 1px 0 rgba(122, 184, 148, 0.3);
```

---

## 🏗️ **Component Design Patterns**

### **Button System**
```css
/* Primary Button (Sage) */
.btn-primary {
  background: linear-gradient(135deg, var(--sage-500), var(--sage-600));
  color: white;
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
  box-shadow: var(--shadow-md);
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, var(--sage-400), var(--sage-500));
  transform: translateY(-1px);
  box-shadow: var(--shadow-lg);
}

/* Secondary Button (Glass) */
.btn-secondary {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--sage-700);
  border-radius: 12px;
  padding: 12px 24px;
}

/* Gold Accent Button */
.btn-gold {
  background: linear-gradient(135deg, var(--gold-400), var(--gold-500));
  color: var(--sage-800);
  border: none;
  border-radius: 12px;
  padding: 12px 24px;
}
```

### **Card System**
```css
/* Main Content Card */
.card-primary {
  background: rgba(255, 255, 255, 0.25);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 20px;
  padding: 24px;
  box-shadow: var(--shadow-lg);
}

/* Feature Card with Hover */
.card-feature {
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 16px;
  padding: 20px;
  transition: all 0.3s ease;
}

.card-feature:hover {
  background: rgba(255, 255, 255, 0.25);
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

/* Statistic Card */
.card-stat {
  background: linear-gradient(135deg, 
    rgba(122, 184, 148, 0.1), 
    rgba(242, 205, 55, 0.08));
  backdrop-filter: blur(10px);
  border: 1px solid rgba(122, 184, 148, 0.2);
  border-radius: 16px;
  padding: 20px;
}
```

### **Navigation System**
```css
/* Top Navigation */
.nav-main {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  padding: 16px 0;
}

/* Navigation Links */
.nav-link {
  color: var(--sage-700);
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
  transition: all 0.2s ease;
}

.nav-link:hover {
  background: rgba(122, 184, 148, 0.1);
  color: var(--sage-800);
}

.nav-link.active {
  background: rgba(122, 184, 148, 0.15);
  color: var(--sage-800);
  font-weight: 600;
}
```

---

## 📱 **Layout Principles**

### **Grid System**
- **Container Max Width**: 1280px (xl)
- **Breakpoints**: 
  - Mobile: 320px - 768px
  - Tablet: 768px - 1024px  
  - Desktop: 1024px - 1280px
  - Large: 1280px+

### **Spacing Scale**
```css
--space-1:  0.25rem   /* 4px */
--space-2:  0.5rem    /* 8px */
--space-3:  0.75rem   /* 12px */
--space-4:  1rem      /* 16px */
--space-5:  1.25rem   /* 20px */
--space-6:  1.5rem    /* 24px */
--space-8:  2rem      /* 32px */
--space-10: 2.5rem    /* 40px */
--space-12: 3rem      /* 48px */
--space-16: 4rem      /* 64px */
--space-20: 5rem      /* 80px */
--space-24: 6rem      /* 96px */
```

### **Augusta Clubhouse Principles**
1. **Generous Whitespace**: Use space-8+ between major sections
2. **Subtle Elegance**: Never overshadow content with flashy design
3. **Natural Hierarchy**: Content flows like a well-designed golf course
4. **Refined Details**: Small touches matter (borders, shadows, transitions)
5. **Timeless Quality**: Avoid trends, focus on enduring aesthetics

---

## 🎬 **Animation & Interactions**

### **Transition Timing**
```css
--ease-in:     cubic-bezier(0.4, 0, 1, 1);
--ease-out:    cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);

/* Duration Scale */
--duration-fast:   150ms;
--duration-normal: 250ms;
--duration-slow:   350ms;
--duration-slower: 500ms;
```

### **Hover States**
- **Cards**: Subtle lift (translateY(-2px)) + shadow increase
- **Buttons**: Slight scale (1.02) + color shift
- **Links**: Color transition + subtle underline
- **Images**: Gentle zoom (scale(1.05)) with overflow hidden

### **Loading States**
- **Shimmer Effect**: Gold-to-sage gradient animation
- **Pulse**: Gentle opacity animation for placeholders
- **Progress**: Sage-to-gold gradient bars

---

## 📋 **Component Specifications**

### **Video Recording Interface**
```css
/* Recording Card */
.recording-card {
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.3),
    rgba(122, 184, 148, 0.1));
  backdrop-filter: blur(16px);
  border: 2px solid rgba(122, 184, 148, 0.2);
  border-radius: 24px;
  padding: 32px;
}

/* Camera Preview */
.camera-preview {
  border-radius: 16px;
  overflow: hidden;
  border: 3px solid rgba(242, 205, 55, 0.3);
  box-shadow: var(--shadow-lg);
}

/* Recording Status */
.status-recording {
  background: rgba(239, 68, 68, 0.9);
  color: white;
  animation: pulse 2s infinite;
}
```

### **Coach Chat Interface**
```css
/* Chat Container */
.chat-container {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.3);
}

/* User Message */
.message-user {
  background: linear-gradient(135deg, var(--sage-400), var(--sage-500));
  color: white;
  border-radius: 18px 18px 4px 18px;
  padding: 12px 16px;
  margin-left: 20%;
}

/* Coach Sarah Message */
.message-coach {
  background: rgba(242, 205, 55, 0.15);
  color: var(--sage-800);
  border-radius: 18px 18px 18px 4px;
  padding: 12px 16px;
  margin-right: 20%;
  border: 1px solid rgba(242, 205, 55, 0.2);
}
```

### **Drill Library Cards**
```css
/* Drill Card */
.drill-card {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 16px;
  overflow: hidden;
  transition: all 0.3s ease;
}

.drill-card:hover {
  background: rgba(255, 255, 255, 0.3);
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}

/* Difficulty Badge */
.difficulty-easy {
  background: var(--success);
  color: white;
}

.difficulty-medium {
  background: var(--warning);
  color: var(--augusta-900);
}

.difficulty-hard {
  background: var(--error);
  color: white;
}
```

---

## 🎨 **Tailwind Configuration**

### **Custom Tailwind Theme Extension**
```javascript
// tailwind.config.js theme extension
module.exports = {
  theme: {
    extend: {
      colors: {
        sage: {
          50: '#f8faf9',
          100: '#e8f2ed',
          200: '#d1e7d8',
          300: '#a8d4b8',
          400: '#7fb894',
          500: '#5a9b6f',
          600: '#4a7f5c',
          700: '#3d6649',
          800: '#2f4d37',
          900: '#203731',
        },
        gold: {
          50: '#fffef7',
          100: '#fefaeb',
          200: '#fdf4d3',
          300: '#fbea9f',
          400: '#f7dc6b',
          500: '#f2cd37',
          600: '#e6b91a',
          700: '#c19d16',
          800: '#9c7f15',
          900: '#FFB612',
        },
        augusta: {
          50: '#ffffff',
          100: '#fefefe',
          200: '#fafafa',
          300: '#f5f5f5',
          400: '#e5e5e5',
          500: '#d4d4d4',
          600: '#a3a3a3',
          700: '#737373',
          800: '#525252',
          900: '#262626',
        }
      },
      fontFamily: {
        'display': ['Playfair Display', 'serif'],
        'serif': ['Crimson Text', 'serif'],
        'sans': ['Inter', 'sans-serif'],
        'mono': ['JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
        sm: '4px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      animation: {
        'pulse-gold': 'pulse-gold 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      }
    }
  }
}
```

---

## 📐 **Implementation Guidelines**

### **Do's**
✅ Use backdrop-blur for all glass surfaces  
✅ Maintain 16px+ border radius for modern feel  
✅ Apply subtle shadows to create depth  
✅ Use sage/gold gradients sparingly for accents  
✅ Ensure 4.5:1+ contrast ratios for accessibility  
✅ Implement smooth transitions on all interactive elements  
✅ Use generous whitespace between sections  

### **Don'ts**
❌ Never use pure black (#000000)  
❌ Avoid sharp corners (< 8px border radius)  
❌ Don't over-blur (max 20px backdrop-filter)  
❌ Never stack more than 3 glass layers  
❌ Avoid bright, saturated colors  
❌ Don't animate layout properties (height, width)  
❌ Never compromise readability for aesthetics  

### **Mobile Considerations**
- **Touch Targets**: Minimum 44px for buttons/links
- **Glass Effects**: Reduce blur intensity on mobile for performance
- **Typography**: Increase base font size to 18px on mobile
- **Spacing**: Use larger margins/padding on mobile
- **Animations**: Respect `prefers-reduced-motion`

---

## 🎯 **Brand Voice in Design**

### **Augusta Clubhouse Characteristics**
- **Understated Luxury**: Quality over flash
- **Timeless Elegance**: Classic proportions and typography
- **Natural Sophistication**: Inspired by golf course beauty
- **Attention to Detail**: Every element considered and purposeful
- **Welcoming Refinement**: Approachable yet distinguished

### **Visual Metaphors**
- **Morning Dew**: Subtle glass effects and soft highlights
- **Fairway Greens**: Sage color variations throughout
- **Golden Hour**: Warm gold accents and soft lighting
- **Pristine Conditions**: Clean lines and perfect spacing
- **Club Tradition**: Classic typography and refined details

---

*"Design is not just what it looks like and feels like. Design is how it works."*  
*— Steve Jobs*

**This design system ensures Pure Golf embodies the sophistication of Augusta National with the modern appeal of glassmorphic design, all wrapped in the unique "Pastel Packers" color story.** 