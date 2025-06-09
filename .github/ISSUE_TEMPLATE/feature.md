---
name: Feature Request
about: Request a new feature for Pure Golf Platform
title: 'feat: [Brief description]'
labels: ['enhancement', 'needs-triage']
assignees: ''
---

## 📋 Feature Description

**User Story:**
As a [type of user], I want [goal] so that [benefit].

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## 🎨 Design & UX

**Wireframes/Mockups:**
[Include links or attach images]

**User Flow:**
1. User starts at...
2. User navigates to...
3. User completes...

## 🔧 Technical Considerations

**Implementation Notes:**
- [ ] Database schema changes needed
- [ ] API endpoints required
- [ ] Third-party integrations
- [ ] Performance considerations

**Dependencies:**
- [ ] Dependency 1
- [ ] Dependency 2

## ✅ Definition of Done

### Code Quality
- [ ] **File size limits respected** (components ≤200 LOC, services ≤300 LOC)
- [ ] **TypeScript strict mode** (no `any` types)
- [ ] **ESLint passes** with no errors
- [ ] **Prettier formatted** consistently
- [ ] **Module boundaries respected** (no cross-layer imports)
- [ ] **Security scan passes** (no secrets, vulnerabilities)

### Testing
- [ ] **Unit tests written** with ≥80% coverage
- [ ] **Integration tests** for API endpoints
- [ ] **E2E tests** for critical user flows
- [ ] **Manual testing** on mobile devices
- [ ] **Accessibility testing** completed

### Documentation
- [ ] **ADR created** for architectural decisions
- [ ] **API documentation** updated (if applicable)
- [ ] **User documentation** updated
- [ ] **Code comments** for complex logic
- [ ] **Changelog entry** added

### Performance
- [ ] **Lighthouse score** ≥90 (if frontend changes)
- [ ] **API response time** <400ms (95th percentile)
- [ ] **Bundle size impact** analyzed
- [ ] **Database queries** optimized

### Deployment
- [ ] **Environment variables** documented
- [ ] **Database migrations** tested
- [ ] **Backward compatibility** maintained
- [ ] **Feature flags** implemented (if needed)
- [ ] **Rollback plan** documented

### Review
- [ ] **Code review** by domain expert
- [ ] **Design review** approved
- [ ] **Product review** accepted
- [ ] **Security review** (if needed)

## 📊 Success Metrics

**How will we measure success?**
- [ ] Metric 1: [target value]
- [ ] Metric 2: [target value]
- [ ] User feedback: [rating target]

## 🔗 Links

- **Related Issues:** #
- **ADR:** docs/adr/ADR-XXX-feature-name.md
- **Design:** [link]
- **Prototype:** [link]

---

**AI Agent Guidelines:**
- Follow conventional commit format: `feat(scope): description`
- Include AI prompt summary in PR description
- Chunk implementation into ≤200 LOC per PR
- Link to this issue in all related PRs 