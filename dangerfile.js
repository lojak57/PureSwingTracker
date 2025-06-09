import { danger, warn, fail, message, markdown } from 'danger';

// Get PR info
const pr = danger.github.pr;
const modified = danger.git.modified_files;
const created = danger.git.created_files;
const deleted = danger.git.deleted_files;
const allFiles = [...modified, ...created];

// === PR SIZE CHECK ===
const bigPRThreshold = 500;
const totalChanges = allFiles.length;

if (totalChanges > bigPRThreshold) {
  warn(`🚨 This PR modifies ${totalChanges} files. Consider breaking it into smaller PRs for easier review.`);
}

// === CONVENTIONAL COMMIT CHECK ===
const commitPattern = /^(feat|fix|docs|style|refactor|perf|test|chore|ci|build|revert)(\(.+\))?: .{1,72}/;
if (!commitPattern.test(pr.title)) {
  fail(`❌ PR title must follow conventional commits format: \`type(scope): description\`
  
Examples:
- \`feat(auth): add OAuth login support\`
- \`fix(video): resolve upload timeout issues\`
- \`docs(api): update endpoints documentation\``);
}

// === TODO/FIXME CHECK ===
const todoPattern = /(TODO|FIXME|XXX|HACK)/i;
const jsFiles = allFiles.filter(f => f.match(/\.(js|ts|tsx|svelte)$/));

for (const file of jsFiles) {
  const content = danger.github.utils.fileContents(file);
  if (content && todoPattern.test(content)) {
    fail(`❌ Found TODO/FIXME in \`${file}\`. Please resolve before merging or create a follow-up issue.`);
  }
}

// === FILE SIZE LIMITS ===
const fileSizeLimits = {
  'src/routes/**/*.svelte': 200,
  'src/components/ui/*.svelte': 150,
  'src/services/*.ts': 300,
  'pose-service/*.py': 400
};

for (const file of jsFiles) {
  const content = danger.github.utils.fileContents(file);
  if (!content) continue;
  
  const lineCount = content.split('\n').length;
  
  // Check against file size rules
  for (const [pattern, limit] of Object.entries(fileSizeLimits)) {
    const regex = new RegExp(pattern.replace('**', '.*').replace('*', '[^/]*'));
    if (regex.test(file) && lineCount > limit) {
      fail(`❌ File \`${file}\` has ${lineCount} lines, exceeding limit of ${limit} LOC. Please refactor.`);
    }
  }
}

// === MISSING TESTS CHECK ===
const sourceFiles = allFiles.filter(f => 
  f.match(/src\/(services|components)\/.*\.(ts|svelte)$/) && 
  !f.includes('.test.') && 
  !f.includes('.spec.')
);

const testFiles = allFiles.filter(f => f.match(/\.(test|spec)\.(ts|js)$/));

if (sourceFiles.length > 0 && testFiles.length === 0) {
  warn(`⚠️ New/modified source files detected but no test files. Consider adding tests for:
${sourceFiles.map(f => `- \`${f}\``).join('\n')}`);
}

// === ADR REQUIREMENT CHECK ===
const hasArchitecturalChanges = allFiles.some(f => 
  f.includes('package.json') ||
  f.includes('.config.') ||
  f.includes('docker') ||
  f.includes('supabase/') ||
  f.match(/src\/(services|lib)\//)
);

const hasADRLink = pr.body.includes('ADR-') || pr.body.includes('docs/adr/');

if (hasArchitecturalChanges && !hasADRLink) {
  warn(`⚠️ This PR appears to make architectural changes but doesn't reference an ADR. 
  Consider creating an ADR at \`docs/adr/ADR-XXX-description.md\` and linking it in the PR description.`);
}

// === DESIGN SYSTEM ENFORCEMENT ===
const designViolations = [];
const svelteFiles = allFiles.filter(f => f.match(/\.svelte$/));

for (const file of svelteFiles) {
  const content = danger.github.utils.fileContents(file);
  if (!content) continue;
  
  // Check for hard-coded hex colors
  const hexPattern = /#[0-9a-fA-F]{3,8}(?![a-fA-F0-9])/g;
  const hexMatches = content.match(hexPattern);
  if (hexMatches) {
    designViolations.push(`❌ Hard-coded hex colors in \`${file}\`: ${hexMatches.join(', ')}`);
  }
  
  // Check for hard-coded RGB/RGBA
  const rgbPattern = /rgba?\([^)]+\)/g;
  const rgbMatches = content.match(rgbPattern);
  if (rgbMatches) {
    designViolations.push(`❌ Hard-coded RGB colors in \`${file}\`: ${rgbMatches.join(', ')}`);
  }
  
  // Check for inline styles with colors
  const inlineStylePattern = /style=["'][^"']*(?:color|background|border-color):[^"']+["']/g;
  const styleMatches = content.match(inlineStylePattern);
  if (styleMatches) {
    designViolations.push(`❌ Inline color styles in \`${file}\`: Use Tailwind classes instead`);
  }
  
  // Check for box-shadow inline styles
  const shadowPattern = /style=["'][^"']*box-shadow:[^"']+["']/g;
  const shadowMatches = content.match(shadowPattern);
  if (shadowMatches) {
    designViolations.push(`❌ Inline shadow styles in \`${file}\`: Use shadow-md, shadow-lg, etc.`);
  }
  
  // Check for non-semantic Tailwind classes
  const badTailwindPattern = /class=["'][^"']*(?:bg-(?:blue|red|green|yellow|purple|pink|indigo)-|text-(?:blue|red|green|yellow|purple|pink|indigo)-)/g;
  const badTailwindMatches = content.match(badTailwindPattern);
  if (badTailwindMatches) {
    designViolations.push(`⚠️ Non-semantic colors in \`${file}\`: Use bg-primary-*, bg-accent-*, text-onSurface-*, etc.`);
  }
}

// Report design system violations
if (designViolations.length > 0) {
  fail(`🎨 **Design System Violations Detected**

${designViolations.join('\n')}

**Fix by using design tokens:**
- ❌ \`#5a9b6f\` → ✅ \`bg-primary-500\`
- ❌ \`rgba(255,255,255,0.2)\` → ✅ \`glass\` utility
- ❌ \`bg-blue-500\` → ✅ \`bg-primary-500\`
- ❌ \`text-gray-700\` → ✅ \`text-onSurface\`

See DESIGN_SYSTEM.md for the complete token reference.`);
}

// Check for missing glass utilities
const glassKeywords = ['backdrop-filter', 'backdrop-blur', 'glass'];
const hasGlassCSS = svelteFiles.some(file => {
  const content = danger.github.utils.fileContents(file);
  return content && glassKeywords.some(keyword => content.includes(keyword));
});

if (hasGlassCSS) {
  message(`✨ Glass effects detected! Ensure you're using the standardized utilities:
- \`glass\` - Primary glass surface  
- \`glass-sage\` - Sage-tinted glass
- \`glass-gold\` - Gold-tinted glass
- \`glass-nav\` - Navigation glass

Avoid custom backdrop-filter values for consistency.`);
}

// === SECURITY CHECK ===
const securityPatterns = [
  /password\s*=\s*['"]/i,
  /api[_-]?key\s*=\s*['"]/i,
  /secret\s*=\s*['"]/i,
  /token\s*=\s*['"]/i,
  /(aws|supabase)[_-]?(access|secret)[_-]?key/i
];

for (const file of allFiles) {
  const content = danger.github.utils.fileContents(file);
  if (!content) continue;
  
  for (const pattern of securityPatterns) {
    if (pattern.test(content)) {
      fail(`🚨 Potential secret detected in \`${file}\`. Please remove hardcoded secrets and use environment variables.`);
    }
  }
}

// === DATABASE MIGRATION CHECK ===
const sqlFiles = allFiles.filter(f => f.match(/\.sql$/));
if (sqlFiles.length > 0) {
  message(`📊 Database changes detected in: ${sqlFiles.map(f => `\`${f}\``).join(', ')}
  
Please ensure:
- [ ] Migration is tested locally
- [ ] Rollback plan is documented
- [ ] Changes are backward compatible
- [ ] RLS policies are updated if needed`);
}

// === DEPENDENCY CHECK ===
if (modified.includes('package.json') || modified.includes('package-lock.json')) {
  message(`📦 Dependencies modified. Please ensure:
- [ ] Security audit passed (\`npm audit\`)
- [ ] Bundle size impact analyzed
- [ ] License compatibility checked`);
}

// === AI AGENT TRACEABILITY ===
const aiIndicators = [
  'AI generated',
  'AI-generated', 
  'Generated by',
  'Prompt:',
  'AI prompt'
];

const hasAIIndicator = aiIndicators.some(indicator => 
  pr.body.toLowerCase().includes(indicator.toLowerCase())
);

if (!hasAIIndicator && pr.user.login.includes('bot')) {
  warn(`🤖 This appears to be AI-generated code but lacks prompt traceability. 
  Please include the AI prompt or summary in the PR description for governance compliance.`);
}

// === SUCCESS MESSAGE ===
if (danger.github.thisPR.additions < 100 && danger.github.thisPR.deletions < 50) {
  message(`✅ Nice focused PR! Small changes are easier to review and less risky to deploy.`);
}

// === MOBILE REMINDER ===
const frontendFiles = allFiles.filter(f => f.match(/src\/(routes|components)\/.*\.svelte$/));
if (frontendFiles.length > 0) {
  message(`📱 Frontend changes detected. Please ensure mobile testing is completed:
- [ ] iOS Safari testing
- [ ] Android Chrome testing  
- [ ] Touch gesture compatibility
- [ ] Responsive design validation`);
} 