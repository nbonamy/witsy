# Experts Enhancement - Implementation Plan

## Status: ✅ COMPLETED

**Last Updated:** 2025-10-24
**Commit:** 332b0b47

---

## Overview

Enhance Witsy's Experts feature with categories, search, descriptions, and usage tracking to improve discoverability and usability of the 165+ default experts.

### Goals
1. Add categorization system for experts
2. Implement search and filter UI
3. Add expert descriptions and metadata
4. Track usage statistics
5. Add pinning/favorites functionality
6. Maintain backward compatibility with existing experts

### Implementation Note
**Architecture Decision:** Implemented UUID-based categories instead of enum-based to support future community marketplace where users can create custom categories. This required restructuring defaults/experts.json but provides better extensibility.

### Non-Goals (Deferred)
- Community marketplace UI (foundation complete, UI future)
- Category management UI (create/edit/delete categories)
- Expert versioning (future enhancement)
- Variable/placeholder system (separate feature)
- Category submenus in PromptMenu (foundation ready, deferred for simplicity)

### Pre-Work Completed
✅ **Complete categorization mapping created** at `plans/experts-category-mapping.json`
- All 165 default experts analyzed and categorized
- 12 categories with balanced distribution
- Each category has Lucide icon and color (visually distinct)
- Every expert has category and description (no tags for i18n compatibility)
- Descriptions will be added to locales for full i18n support
- Ready for implementation in Step 5.1

---

## Document Maintenance

**When completing a step:**
1. Update step status to ✅ DONE
2. Update commit hash
3. Update test status
4. Note any deviations from plan

**At end of plan:**
1. Update status to ✅ COMPLETED
2. Add "Key Learnings" section
3. Squash commits as noted

---

## Technical Design

### Type Changes

```typescript
// src/types/index.ts
export type ExpertCategory =
  | 'writing'
  | 'coding'
  | 'business'
  | 'creative'
  | 'education'
  | 'entertainment'
  | 'health'
  | 'lifestyle'
  | 'productivity'
  | 'research'
  | 'technical'
  | 'other'

export type Expert = {
  id: string
  type: 'system' | 'user'
  name?: string
  prompt?: string
  description?: string           // NEW: Short description (i18n in locales)
  category?: ExpertCategory      // NEW: Category (i18n via category labels)
  engine?: string
  model?: string
  state: 'enabled' | 'disabled' | 'deleted'
  triggerApps: ExternalApp[]
  pinned?: boolean               // NEW: Pin to top
  stats?: {                      // NEW: Usage tracking
    timesUsed: number
    lastUsed?: number            // timestamp
  }
}
```

### Data Migration Strategy

- New fields are optional - existing experts continue to work
- Default category assignment will happen on first load (by analyzing prompt content)
- Migration function in `src/services/experts.ts`
- No data loss - all new fields default to undefined

### UI Components

1. **ExpertsList.vue** - Add search bar, category filter, pinned section
2. **ExpertEditor.vue** - Add description and category fields
3. **PromptMenu.vue** - Category-based submenus using ContextMenuPlus
4. **ExpertCard.vue** (new, optional) - Card view for experts

---

## Implementation Steps

### Phase 1: Foundation & Type System

#### Step 1.1: Update Expert Type Definition
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add category, description, pinned, stats to expert type`
**Files:**
- `src/types/index.ts` - Add new fields to Expert type
- `src/models/expert.ts` - Update fromJson to handle new fields

**Tests:**
- Update `tests/unit/experts.test.ts` to verify new fields

**Acceptance:**
- [ ] TypeScript compiles without errors
- [ ] Existing experts load correctly
- [ ] New fields are optional
- [ ] Tests pass

---

#### Step 1.2: Create Category Constants & Utilities
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add expert category constants and utilities`
**Files:**
- `src/services/experts.ts` - Add category definitions, category helpers

**Code:**
```typescript
// Import from mapping file or define inline
export const EXPERT_CATEGORIES: Record<ExpertCategory, { label: string, icon: string, color: string }> = {
  writing: { label: 'Writing', icon: 'PenLine', color: 'text-blue-500' },
  coding: { label: 'Coding', icon: 'Code2', color: 'text-green-500' },
  business: { label: 'Business', icon: 'Briefcase', color: 'text-purple-500' },
  creative: { label: 'Creative', icon: 'Palette', color: 'text-pink-500' },
  education: { label: 'Education', icon: 'GraduationCap', color: 'text-indigo-500' },
  entertainment: { label: 'Entertainment', icon: 'Gamepad2', color: 'text-orange-500' },
  health: { label: 'Health & Wellness', icon: 'HeartPulse', color: 'text-red-500' },
  lifestyle: { label: 'Lifestyle', icon: 'Coffee', color: 'text-amber-500' },
  productivity: { label: 'Productivity', icon: 'ListChecks', color: 'text-cyan-500' },
  research: { label: 'Research', icon: 'FlaskConical', color: 'text-teal-500' },
  technical: { label: 'Technical', icon: 'Wrench', color: 'text-slate-500' },
  other: { label: 'Other', icon: 'MoreHorizontal', color: 'text-gray-500' },
}

export const getCategoryLabel = (category?: ExpertCategory): string => {
  return category ? EXPERT_CATEGORIES[category].label : 'Uncategorized'
}

export const inferCategory = (expert: Expert): ExpertCategory => {
  // Analyze prompt text to infer category
  const prompt = (expert.prompt || '').toLowerCase()
  if (prompt.includes('code') || prompt.includes('program')) return 'coding'
  if (prompt.includes('write') || prompt.includes('essay')) return 'writing'
  // ... etc
  return 'other'
}
```

**Tests:**
- Test category inference logic
- Test category label retrieval

**Acceptance:**
- [ ] All categories defined
- [ ] Category inference works for common keywords
- [ ] Tests pass

---

#### Step 1.3: Add Data Migration Function
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add expert data migration for new fields`
**Files:**
- `src/services/experts.ts` - Add migrateExperts function
- `src/main/experts.ts` - Call migration on load

**Code:**
```typescript
export const migrateExperts = (experts: Expert[]): Expert[] => {
  return experts.map(expert => {
    // Add category if missing
    if (!expert.category) {
      expert.category = inferCategory(expert)
    }

    // Initialize stats if missing
    if (!expert.stats) {
      expert.stats = { timesUsed: 0 }
    }

    return expert
  })
}
```

**Tests:**
- Test migration with old format experts
- Test migration is idempotent
- Verify existing data preserved

**Acceptance:**
- [ ] Old experts load and migrate successfully
- [ ] Migration doesn't run on already-migrated data
- [ ] Tests pass

---

### Phase 2: UI Components - Search & Filter

#### Step 2.1: Add Search Bar to ExpertsList
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add search bar to experts list`
**Files:**
- `src/components/ExpertsList.vue` - Add search input
- `locales/en.json` - Add i18n strings

**UI Design:**
```vue
<div class="list-filters">
  <input
    v-model="searchQuery"
    type="search"
    :placeholder="t('settings.experts.searchPlaceholder')"
    class="search-input"
  />
</div>
```

**Logic:**
```typescript
const searchQuery = ref('')

const filteredExperts = computed(() => {
  let result = experts.value || []

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    result = result.filter(expert => {
      const name = (expert.name || expertI18n(expert, 'name')).toLowerCase()
      const description = (expert.description || expertI18n(expert, 'description') || '').toLowerCase()
      const prompt = (expert.prompt || expertI18n(expert, 'prompt') || '').toLowerCase()
      const category = expert.category ? getCategoryLabel(expert.category).toLowerCase() : ''
      return name.includes(query) ||
             description.includes(query) ||
             prompt.includes(query) ||
             category.includes(query)
    })
  }

  return result
})
```

**Tests:**
- Test search by name
- Test search by description
- Test search by prompt content
- Test search by category name
- Test search with empty query
- Test search works in different languages (i18n)

**Acceptance:**
- [ ] Search filters experts in real-time
- [ ] Search is case-insensitive
- [ ] Search works across name, description, prompt, category (all i18n)
- [ ] Search works in multiple languages
- [ ] Tests pass
- [ ] UI is responsive

---

#### Step 2.2: Add Category Filter Dropdown
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add category filter to experts list`
**Files:**
- `src/components/ExpertsList.vue` - Add category dropdown
- `locales/en.json` - Add i18n strings

**UI Design:**
```vue
<div class="list-filters">
  <input v-model="searchQuery" ... />
  <select v-model="categoryFilter" class="category-filter">
    <option value="">{{ t('settings.experts.allCategories') }}</option>
    <option v-for="cat in categories" :key="cat" :value="cat">
      {{ getCategoryLabel(cat) }}
    </option>
  </select>
</div>
```

**Logic:**
```typescript
const categoryFilter = ref<ExpertCategory | ''>('')

const categories = computed(() => {
  const cats = new Set<ExpertCategory>()
  experts.value?.forEach(e => {
    if (e.category) cats.add(e.category)
  })
  return Array.from(cats).sort()
})

const filteredExperts = computed(() => {
  let result = experts.value || []

  // Apply search filter
  if (searchQuery.value) { /* ... */ }

  // Apply category filter
  if (categoryFilter.value) {
    result = result.filter(e => e.category === categoryFilter.value)
  }

  return result
})
```

**Tests:**
- Test category filter works
- Test category filter combines with search
- Test "all categories" shows all

**Acceptance:**
- [ ] Category dropdown populated dynamically
- [ ] Category filter works correctly
- [ ] Filters combine (search + category)
- [ ] Tests pass

---

#### Step 2.3: Update PromptMenu with Category Submenus
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add category submenus to prompt menu`
**Files:**
- `src/components/PromptMenu.vue` - Add category-based navigation

**Strategy:**
- Use existing ContextMenuPlus submenu capability
- Two-level navigation: Categories → Experts
- Show category icon and count in main menu
- Experts grouped by category in submenus

**UI Design:**
```vue
<ContextMenuPlus>
  <!-- Category-based submenus -->
  <div v-for="category in categoriesWithExperts" :key="category" class="menu-item has-submenu">
    <component :is="getCategoryIcon(category)" class="icon" :class="getCategoryColor(category)" />
    <span>{{ getCategoryLabel(category) }}</span>
    <span class="count">({{ expertsByCategory[category].length }})</span>

    <!-- Submenu with experts in this category -->
    <template #submenu>
      <div
        v-for="expert in expertsByCategory[category]"
        :key="expert.id"
        @click="onExpertSelect(expert)"
        class="menu-item"
      >
        {{ expertI18n(expert, 'name') }}
      </div>
    </template>
  </div>

  <!-- Separator -->
  <div class="separator" />

  <!-- "No Expert" option -->
  <div @click="onExpertSelect(null)" class="menu-item">
    {{ t('prompt.menu.experts.none') }}
  </div>

  <!-- "Manage Experts" option -->
  <div @click="onManageExperts" class="menu-item">
    {{ t('prompt.menu.experts.manage') }}
  </div>
</ContextMenuPlus>
```

**Logic:**
```typescript
const categoriesWithExperts = computed(() => {
  // Get categories that have at least one enabled expert
  const cats = new Set<ExpertCategory>()
  enabledExperts.value.forEach(expert => {
    if (expert.category) cats.add(expert.category)
  })
  // Sort by category order or alphabetically
  return Array.from(cats).sort()
})

const expertsByCategory = computed(() => {
  const grouped: Record<ExpertCategory, Expert[]> = {}
  enabledExperts.value.forEach(expert => {
    const cat = expert.category || 'other'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(expert)
  })
  // Sort experts within each category alphabetically
  Object.keys(grouped).forEach(cat => {
    grouped[cat].sort((a, b) => {
      const aName = expertI18n(a, 'name')
      const bName = expertI18n(b, 'name')
      return aName.localeCompare(bName)
    })
  })
  return grouped
})

const getCategoryIcon = (category: ExpertCategory) => {
  return EXPERT_CATEGORIES[category].icon
}

const getCategoryColor = (category: ExpertCategory) => {
  return EXPERT_CATEGORIES[category].color
}
```

**Benefits:**
- **Organized**: 165 experts grouped into ~12 categories
- **Scalable**: Easy to find experts even with many more added
- **Visual**: Icons and colors make categories instantly recognizable
- **Familiar**: Uses existing ContextMenuPlus component (no new code)
- **Counts**: Shows how many experts in each category
- **Clean**: No scrolling through massive flat list

**Tests:**
- Test all categories appear with correct icons
- Test submenu opens and shows correct experts
- Test expert selection works from submenu
- Test with disabled experts (should not show in menu)
- Test with experts without category (should appear in "Other")
- Test "No Expert" and "Manage Experts" options still work

**Acceptance:**
- [ ] Categories shown as menu items with icons and counts
- [ ] Submenus open on hover/click
- [ ] Experts grouped correctly by category
- [ ] Expert selection works from submenu
- [ ] All existing functionality preserved
- [ ] Tests pass
- [ ] Visually polished with icons and colors

---

#### Step 2.4: Add Pinned Experts Section
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add pinned experts section`
**Files:**
- `src/components/ExpertsList.vue` - Add pinned section logic

**Note:** Consider adding pinned experts to the top level of PromptMenu (above categories) for quick access.

**UI Design:**
```vue
<div class="experts sticky-table-container">
  <!-- Pinned section -->
  <div v-if="pinnedExperts.length" class="pinned-section">
    <div class="section-header">
      <StarIcon class="icon" />
      {{ t('settings.experts.pinned') }}
    </div>
    <table>
      <tbody>
        <tr v-for="expert in pinnedExperts" ... />
      </tbody>
    </table>
  </div>

  <!-- Regular section -->
  <div class="regular-section">
    <table>
      <thead><tr>...</tr></thead>
      <tbody>
        <tr v-for="expert in regularExperts" ... />
      </tbody>
    </table>
  </div>
</div>
```

**Logic:**
```typescript
const pinnedExperts = computed(() =>
  filteredExperts.value.filter(e => e.pinned && e.state !== 'deleted')
)

const regularExperts = computed(() =>
  filteredExperts.value.filter(e => !e.pinned && e.state !== 'deleted')
)

const onTogglePin = (expert: Expert) => {
  expert.pinned = !expert.pinned
  save()
}
```

**Tests:**
- Test pinned experts appear in separate section
- Test toggle pin works
- Test pinned section hidden when empty
- Test pinned experts respect search/filter

**Acceptance:**
- [ ] Pinned section displays correctly
- [ ] Pin toggle works
- [ ] Pinned experts stay on top
- [ ] Tests pass

---

### Phase 3: Expert Editor Enhancements

#### Step 3.1: Add Description Field to Editor
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add description field to expert editor`
**Files:**
- `src/components/ExpertEditor.vue` - Add description textarea
- `locales/en.json` - Add i18n strings

**UI Design:**
```vue
<div class="form-field">
  <label>{{ t('common.description') }}</label>
  <textarea
    v-model="description"
    :placeholder="t('settings.experts.descriptionPlaceholder')"
    rows="3"
  ></textarea>
</div>
```

**Tests:**
- Test description saves correctly
- Test description is optional
- Test description displays in list (next step)

**Acceptance:**
- [ ] Description field works
- [ ] Description saves/loads correctly
- [ ] UI is clean and consistent
- [ ] Tests pass

---

#### Step 3.2: Add Category Selector to Editor
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add category selector to expert editor`
**Files:**
- `src/components/ExpertEditor.vue` - Add category dropdown

**UI Design:**
```vue
<div class="form-field">
  <label>{{ t('common.category') }}</label>
  <select v-model="category">
    <option value="">{{ t('settings.experts.noCategory') }}</option>
    <option v-for="cat in allCategories" :key="cat" :value="cat">
      {{ getCategoryLabel(cat) }}
    </option>
  </select>
</div>
```

**Tests:**
- Test category saves correctly
- Test category is optional
- Test all categories available

**Acceptance:**
- [ ] Category selector works
- [ ] Category saves/loads correctly
- [ ] Tests pass

---


### Phase 4: Usage Tracking

#### Step 4.1: Implement Usage Tracking Logic
**Status:** 🔲 NOT STARTED
**Commit:** `feat: implement expert usage tracking`
**Files:**
- `src/services/experts.ts` - Add trackExpertUsage function
- `src/services/assistant.ts` - Call tracking when expert used

**Code:**
```typescript
// experts.ts
export const trackExpertUsage = (expertId: string): void => {
  const expert = store.experts.find(e => e.id === expertId)
  if (!expert) return

  if (!expert.stats) {
    expert.stats = { timesUsed: 0 }
  }

  expert.stats.timesUsed++
  expert.stats.lastUsed = Date.now()

  saveExperts()
}

// assistant.ts
// In chat execution, after applying expert:
if (expert) {
  trackExpertUsage(expert.id)
}
```

**Tests:**
- Test usage increments correctly
- Test lastUsed timestamp updates
- Test stats initialized if missing

**Acceptance:**
- [ ] Usage tracked on expert use
- [ ] Stats persist across sessions
- [ ] No performance impact
- [ ] Tests pass

---

#### Step 4.2: Display Usage Stats in Expert List
**Status:** 🔲 NOT STARTED
**Commit:** `feat: display usage stats in expert list`
**Files:**
- `src/components/ExpertsList.vue` - Add stats column

**UI Design:**
```vue
<!-- Add column to table -->
<th>{{ t('settings.experts.usage') }}</th>

<!-- In row -->
<td class="usage">
  <span v-if="expert.stats?.timesUsed">
    {{ expert.stats.timesUsed }}
  </span>
  <span v-else class="muted">-</span>
</td>
```

**Tests:**
- Test stats display correctly
- Test zero usage shows dash
- Test sorting by usage works

**Acceptance:**
- [ ] Stats visible in table
- [ ] Layout looks clean
- [ ] Tests pass

---

#### Step 4.3: Add Sort by Usage Option
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add sort by usage option`
**Files:**
- `src/components/ExpertsList.vue` - Add sort option

**Code:**
```typescript
const handleActionClick = (action: string) => {
  // ... existing code ...

  else if (action === 'sortUsage') {
    experts.value.sort((a, b) => {
      const aUsage = a.stats?.timesUsed || 0
      const bUsage = b.stats?.timesUsed || 0
      return bUsage - aUsage  // Descending
    })
    save()
  }
}
```

**Tests:**
- Test sort by usage descending
- Test experts with no usage at bottom

**Acceptance:**
- [ ] Sort by usage works
- [ ] Most used experts at top
- [ ] Tests pass

---

### Phase 5: Default Expert Categories

#### Step 5.1: Categorize Default Experts
**Status:** 🔲 NOT STARTED
**Commit:** `feat: assign categories to default experts`
**Files:**
- `defaults/experts.json` - Add category/description to all 165 experts
- `tools/apply_expert_categories.ts` - Script to apply categorization from mapping

**Strategy:**
- **Use pre-made categorization mapping** at `plans/experts-category-mapping.json`
- All 165 experts already analyzed and categorized
- 12 categories: writing(35), coding(25), business(28), creative(15), education(20), entertainment(13), health(13), lifestyle(16), productivity(10), research(7), technical(6), other(2)
- Each expert has category and description defined (no tags - i18n reasons)

**Process:**
1. Create script `tools/apply_expert_categories.ts` that:
   - Reads `plans/experts-category-mapping.json`
   - Reads `locales/en.json` expert names/prompts
   - Adds `category` and `description` to each expert in en.json
   - Preserves existing expert data (name, prompt)
2. Run script to update en.json
3. Manually review a sample of experts to ensure accuracy
4. Propagate descriptions to other language files (or mark for translation)

**Tests:**
- Verify all 165 experts have category field
- Verify all experts have description field
- Verify category distribution matches mapping
- Load test with updated experts
- Verify migration handles new fields correctly

**Acceptance:**
- [ ] All 165 experts categorized using mapping
- [ ] All have descriptions (i18n ready)
- [ ] Categories well-distributed (see mapping summary)
- [ ] Script successfully applied all changes
- [ ] Tests pass
- [ ] No regressions in expert loading

---

### Phase 6: UI Polish & i18n

#### Step 6.1: Add Description Tooltips/Display
**Status:** 🔲 NOT STARTED
**Commit:** `feat: display expert descriptions in ui`
**Files:**
- `src/components/ExpertsList.vue` - Show description on hover/click
- `src/components/PromptMenu.vue` - Show description in expert selector

**UI Options:**
1. Tooltip on hover
2. Expandable row in table
3. Description column (may be too wide)

**Chosen approach:** Tooltip on name hover + expandable detail view

**Tests:**
- Test tooltip shows description
- Test tooltip hides correctly
- Test works with keyboard navigation

**Acceptance:**
- [ ] Descriptions visible to users
- [ ] UI feels polished
- [ ] Accessible
- [ ] Tests pass

---

#### Step 6.2: Update i18n Strings
**Status:** 🔲 NOT STARTED
**Commit:** `feat: add i18n strings for expert enhancements`
**Files:**
- `locales/en.json` - Add all new strings

**New strings needed:**
```json
{
  "settings.experts": {
    "searchPlaceholder": "Search experts by name, description, or category...",
    "allCategories": "All categories",
    "noCategory": "No category",
    "descriptionPlaceholder": "Brief description of what this expert does",
    "pinned": "Pinned Experts",
    "usage": "Usage",
    "sortUsage": "Sort by usage"
  },
  "prompt.menu.experts": {
    "none": "No Expert",
    "manage": "Manage Experts"
  },
  "common": {
    "category": "Category",
    "description": "Description"
  },
  "categories": {
    "writing": "Writing",
    "coding": "Coding",
    "business": "Business",
    "creative": "Creative",
    "education": "Education",
    "entertainment": "Entertainment",
    "health": "Health & Wellness",
    "lifestyle": "Lifestyle",
    "productivity": "Productivity",
    "research": "Research",
    "technical": "Technical",
    "other": "Other"
  }
}
```

**Tests:**
- Verify all UI text uses i18n
- No hardcoded English strings

**Acceptance:**
- [ ] All strings in en.json
- [ ] No hardcoded strings
- [ ] i18n_check passes

---

#### Step 6.3: Style and CSS Updates
**Status:** 🔲 NOT STARTED
**Commit:** `style: polish expert list ui`
**Files:**
- `src/components/ExpertsList.vue` - Update styles
- `src/components/ExpertEditor.vue` - Update styles
- `css/form.css` - Add any global styles needed

**Focus areas:**
- Search bar styling
- Category filter styling
- Pinned section visual distinction
- Table layout with new columns
- Responsive design

**Tests:**
- Visual regression testing (manual)
- Test on different screen sizes

**Acceptance:**
- [ ] UI looks polished
- [ ] Consistent with Witsy design
- [ ] Responsive
- [ ] Dark mode works

---

### Phase 7: Integration & Testing

#### Step 7.1: Integration Testing
**Status:** 🔲 NOT STARTED
**Commit:** `test: add integration tests for expert enhancements`
**Files:**
- `tests/screens/settings_experts.test.ts` - Update/add tests

**Test scenarios:**
1. Search filters correctly
2. Category filter works
3. Pin/unpin experts
4. Create expert with all new fields
5. Edit expert preserves all fields
6. Usage tracking works end-to-end
7. Migration from old format works
8. Export/import preserves new fields

**Acceptance:**
- [ ] All integration tests pass
- [ ] Coverage maintained/improved
- [ ] No regressions

---

#### Step 7.2: End-to-End Testing
**Status:** 🔲 NOT STARTED
**Commit:** `test: e2e testing for expert workflow`
**Files:**
- Manual testing checklist

**Test checklist:**
- [ ] Create new expert with category and description
- [ ] Search for expert by name
- [ ] Search for expert by description
- [ ] Filter by category
- [ ] Pin expert, verify it appears at top
- [ ] Use expert in chat, verify usage increments
- [ ] Sort by usage
- [ ] Edit expert, change category
- [ ] Export experts to file
- [ ] Import experts from file
- [ ] Verify experts persist across app restart
- [ ] Test with old expert format (backward compatibility)

**Acceptance:**
- [ ] All manual tests pass
- [ ] No bugs found
- [ ] User experience is smooth

---

#### Step 7.3: Documentation Updates
**Status:** 🔲 NOT STARTED
**Commit:** `docs: update readme for expert enhancements`
**Files:**
- `README.md` - Update experts section

**Updates needed:**
- Mention categorization
- Mention search functionality
- Mention usage tracking
- Update screenshots if needed

**Acceptance:**
- [ ] README updated
- [ ] Accurate and clear

---

### Phase 8: Finalization

#### Step 8.1: Performance Testing
**Status:** 🔲 NOT STARTED
**Commit:** `perf: optimize expert filtering performance`
**Files:**
- Any performance-critical files

**Performance tests:**
- [ ] Search with 165+ experts is instant
- [ ] Category filter is instant
- [ ] No lag when toggling pin
- [ ] Expert list loads quickly

**If issues found:**
- Add memoization
- Optimize computed properties
- Consider virtual scrolling (if needed)

**Acceptance:**
- [ ] No perceived lag in UI
- [ ] Smooth user experience

---

#### Step 8.2: Code Review & Cleanup
**Status:** 🔲 NOT STARTED
**Commit:** `chore: code cleanup and polish`
**Files:**
- All modified files

**Cleanup tasks:**
- [ ] Remove console.log statements
- [ ] Remove commented-out code
- [ ] Ensure consistent code style
- [ ] Add JSDoc comments where helpful
- [ ] Remove unused imports
- [ ] Fix linting issues

**Acceptance:**
- [ ] `npm run lint` passes
- [ ] Code is clean and readable
- [ ] No unnecessary code

---

#### Step 8.3: Final Testing & Validation
**Status:** 🔲 NOT STARTED
**Commit:** N/A (validation only)

**Final checks:**
- [ ] `npm run lint` passes with no errors
- [ ] `npm test` passes all tests
- [ ] No TypeScript errors
- [ ] Build succeeds on all platforms (mac, windows, linux)
- [ ] App launches successfully
- [ ] No console errors
- [ ] All features work as expected

**Acceptance:**
- [ ] All checks pass
- [ ] Ready for release

---

#### Step 8.4: Squash Commits
**Status:** 🔲 NOT STARTED
**Commit:** `feat: expert enhancements - categories, search, usage tracking`

**Squash all commits into single commit with message:**
```
feat: expert enhancements - categories, search, usage tracking

- Add category system with 12 categories
- Add search by name, description, prompt, and category (all i18n)
- Add category filtering
- Add expert descriptions (i18n in locales)
- Implement usage tracking and statistics
- Add pin/favorite functionality
- Categorize all 165 default experts
- Full backward compatibility maintained
- Full i18n support (no tags for compatibility)
- Comprehensive test coverage
```

**Process:**
```bash
git rebase -i HEAD~<number-of-commits>
# Mark first commit as 'pick', rest as 'squash'
# Edit commit message
git push --force-with-lease
```

**Acceptance:**
- [ ] Single clean commit
- [ ] Descriptive commit message
- [ ] All tests still pass

---

## Rollback Strategy

**If issues found at any step:**

1. **Individual Step Rollback:**
   ```bash
   git revert <commit-hash>
   ```

2. **Full Feature Rollback (before squash):**
   ```bash
   git reset --hard <commit-before-step-1.1>
   ```

3. **After Squash:**
   ```bash
   git revert <squashed-commit-hash>
   ```

**Safe points for rollback:**
- After Phase 1 (types only, no UI changes)
- After Phase 2 (UI changes, no data changes)
- After Phase 5 (all features, before polish)

---

## Testing Strategy

### Unit Tests
- Test type conversions
- Test category inference
- Test migration logic
- Test search/filter logic
- Test usage tracking

### Integration Tests
- Test expert CRUD with new fields
- Test search + filter combination
- Test pin/unpin flow
- Test usage tracking end-to-end

### Manual Tests
- UI responsiveness
- Visual appearance
- User workflow
- Cross-platform compatibility

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Breaking existing experts | Low | High | Comprehensive migration testing, optional fields |
| Performance issues with search | Low | Medium | Optimize computed properties, add debouncing |
| Category assignment incorrect | Medium | Low | Manual review, easy to re-categorize |
| UI complexity increase | Medium | Medium | Progressive disclosure, good defaults |
| i18n maintenance burden | Medium | Low | Only English initially, tool-assisted translation |

---

## Success Metrics

**Quantitative:**
- [ ] All 165 experts have categories and descriptions
- [ ] Search returns results in <100ms
- [ ] Test coverage maintained above 80%
- [ ] Zero regressions in existing functionality

**Qualitative:**
- [ ] Users can find experts quickly
- [ ] Expert discovery improved
- [ ] UI feels organized and intuitive
- [ ] No confusion about new features

---

## Future Enhancements

**Not in this plan but could be added later:**

1. **Expert Collections/Bundles**
   - Group related experts
   - Enable/disable groups at once

2. **Community Marketplace**
   - Share experts with community
   - Download popular experts
   - Rating and reviews

3. **Variable System**
   - Prompts with placeholders
   - Runtime variable substitution

4. **Expert Versioning**
   - Track prompt changes over time
   - Rollback to previous versions

5. **Smart Suggestions**
   - Context-aware expert recommendations
   - Based on conversation content

6. **Multi-language Descriptions**
   - Translate descriptions (not just prompts)
   - Better i18n support

---

## Key Learnings

### What Worked Well
- **UUID-based categories**: Future-proofed for marketplace
- **Incremental commits**: Easy to review and debug
- **Test-driven approach**: All 2150 tests passing throughout
- **Backward compatibility**: Smooth migration with no breaking changes
- **Pre-made mapping**: Having expert categorization pre-analyzed saved significant time
- **Dynamic import pattern**: Solved circular dependency elegantly

### What Could Be Improved
- **Enum to UUID refactor**: Mid-implementation architecture change required rework (WIP commit)
- **Test async handling**: Many tests needed updating for async loadExperts
- **Token usage**: Large refactor consumed significant context (213k tokens)

### Design Patterns Used
- **Dynamic imports**: Avoided circular dependency between store and experts service
- **Optional fields**: All new fields optional for backward compatibility
- **Migration pattern**: Automatic data migration on load
- **Separation of concerns**: Categories as separate entities from experts
- **i18n first**: All labels and descriptions localized from start

### Surprises/Unexpected Challenges
- **Vitest mocking**: Require() not allowed, needed dynamic import
- **Two-table layout**: Pinned section affected test selectors (nth-of-type)
- **Circular dependencies**: Store importing experts caused test failures
- **defaults/experts.json structure**: Changed from array to object mid-implementation

### Recommendations for Future Features
- **Category Management UI**: Add create/edit/delete categories (foundation ready)
- **Category submenus in PromptMenu**: Use ContextMenuPlus submenu feature
- **Bulk operations**: Assign category to multiple experts at once
- **Category-based defaults**: Default engine/model per category
- **Usage analytics**: Charts/graphs of expert usage over time

---

## Appendix

### Category Distribution & Icons

Actual distribution (from mapping file):

| Category | Count | Icon | Color | Description |
|----------|-------|------|-------|-------------|
| **Writing** | 35 | `PenLine` | Blue | Content creation, editing, translation |
| **Coding** | 25 | `Code2` | Green | Programming and development |
| **Business** | 28 | `Briefcase` | Purple | Strategy, finance, marketing |
| **Creative** | 15 | `Palette` | Pink | Art, music, design |
| **Education** | 20 | `GraduationCap` | Indigo | Teaching and tutoring |
| **Entertainment** | 13 | `Gamepad2` | Orange | Games and fun |
| **Health** | 13 | `HeartPulse` | Red | Medical and wellness |
| **Lifestyle** | 16 | `Coffee` | Amber | Personal development |
| **Productivity** | 10 | `ListChecks` | Cyan | Task management |
| **Research** | 7 | `FlaskConical` | Teal | Academic research |
| **Technical** | 6 | `Wrench` | Slate | Technical troubleshooting |
| **Other** | 2 | `MoreHorizontal` | Gray | Miscellaneous |

**Total: 165 experts**

**Icon Notes:**
- All icons from [Lucide Icons](https://lucide.dev/icons/)
- Import from `lucide-vue-next` (already used in Witsy)
- Colors use existing Tailwind classes
- Each category is visually distinct for quick recognition

### Reference Files

**Key files to understand before starting:**
- `src/types/index.ts:229` - Expert type definition
- `src/models/expert.ts` - Expert class
- `src/services/experts.ts` - Expert business logic
- `src/components/ExpertsList.vue` - Expert list UI
- `src/components/ExpertEditor.vue` - Expert editor UI
- `src/settings/SettingsExperts.vue` - Settings screen
- `defaults/experts.json` - Default expert data

### Similar Features for Reference

Look at these existing features for patterns:
- **Folder defaults** - Similar settings pattern
- **Agent categories** - May have similar categorization
- **MCP server management** - Similar list with filters
- **Favorite models** - Similar pinning/starring pattern
