#!/bin/bash

# Script to replace relative paths with TypeScript path aliases
# Order matters - most specific paths first to avoid incorrect replacements

set -e

echo "🔍 Finding all .ts and .vue files..."

# Find all TypeScript and Vue files, excluding build artifacts
FILES=$(find . -type f \( -name "*.ts" -o -name "*.vue" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/out/*" \
  -not -path "*/dist/*" \
  -not -path "*/.vite/*" \
  -not -path "*/build/*")

echo "📝 Replacing paths (in order of specificity)..."

# # 1. @tests/* - Test utilities (mocks, helpers, etc.)
# echo "  - @tests/mocks/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./mocks/\([^']*\)'|from '@tests/mocks/\1'|g"
# 
# echo "  - @tests/* (other)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./tests/\([^']*\)'|from '@tests/\1'|g"
# 
# # 2. @components/* - src/renderer/components
# echo "  - @components/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/components/\([^']*\)'|from '@components/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/renderer/components/\([^']*\)'|from '@components/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/renderer/components/\([^']*\)'|from '@components/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/renderer/components/\([^']*\)'|from '@components/\1'|g"
# 
# # 3. @composables/* - src/renderer/composables
# echo "  - @composables/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/composables/\([^']*\)'|from '@composables/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/renderer/composables/\([^']*\)'|from '@composables/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/renderer/composables/\([^']*\)'|from '@composables/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/renderer/composables/\([^']*\)'|from '@composables/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./composables/\([^']*\)'|from '@composables/\1'|g"
# 
# # 4. @services/* - src/renderer/services
# echo "  - @services/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/services/\([^']*\)'|from '@services/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/renderer/services/\([^']*\)'|from '@services/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/renderer/services/\([^']*\)'|from '@services/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/renderer/services/\([^']*\)'|from '@services/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./services/\([^']*\)'|from '@services/\1'|g"
# 
# # 5. @screens/* - src/renderer/screens
# echo "  - @screens/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/screens/\([^']*\)'|from '@screens/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/renderer/screens/\([^']*\)'|from '@screens/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/renderer/screens/\([^']*\)'|from '@screens/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/renderer/screens/\([^']*\)'|from '@screens/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./screens/\([^']*\)'|from '@screens/\1'|g"
# 
# # 6. @renderer/* - other src/renderer paths (utils, audio, directives, etc.)
# echo "  - @renderer/* (other)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/\([^']*\)'|from '@renderer/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/renderer/\([^']*\)'|from '@renderer/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/renderer/\([^']*\)'|from '@renderer/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/renderer/\([^']*\)'|from '@renderer/\1'|g"
# 
# # 7. @main/* - src/main
# echo "  - @main/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/main/\([^']*\)'|from '@main/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/main/\([^']*\)'|from '@main/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/main/\([^']*\)'|from '@main/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./src/main/\([^']*\)'|from '@main/\1'|g"
# 
# # 8. @models/* - src/models
# echo "  - @models/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/models/\([^']*\)'|from '@models/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/models/\([^']*\)'|from '@models/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/models/\([^']*\)'|from '@models/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./models/\([^']*\)'|from '@models/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./models/\([^']*\)'|from '@models/\1'|g"
# 
# # 9. @/* - other src paths (types, plugins, vendor, etc.)
# echo "  - @/* (other src)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./src/\([^']*\)'|from '@/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./src/\([^']*\)'|from '@/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./src/\([^']*\)'|from '@/\1'|g"
# 
# echo ""
# echo "📝 Round 2: Shorter relative paths and other patterns..."
# 
# # 10. vi.mock() calls - need to handle these separately
# echo "  - vi.mock() paths"
# echo "$FILES" | xargs sed -i '' "s|vi\\.mock('\\.\\.*/src/renderer/\([^']*\)'|vi.mock('@renderer/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|vi\\.mock('\\.\\.*/src/models/\([^']*\)'|vi.mock('@models/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|vi\\.mock('\\.\\.*/src/main/\([^']*\)'|vi.mock('@main/\1'|g"
# 
# # 11. types/* - 2-level from src/renderer
# echo "  - types/* (2-level)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./types/\([^']*\)'|from 'types/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./types/\([^']*\)'|from 'types/\1'|g"
# 
# # 12. @models/* - 2-level patterns
# echo "  - @models/* (2-level)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./models/\([^']*\)'|from '@models/\1'|g"
# 
# # 13. @renderer/* - 2-level patterns (utils, audio, etc.)
# echo "  - @renderer/* (2-level)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./utils/\([^']*\)'|from '@renderer/utils/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./utils/\([^']*\)'|from '@renderer/utils/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./audio/\([^']*\)'|from '@renderer/audio/\1'|g"
# 
# # 14. @main/* - 2-level from src/renderer
# echo "  - @main/* (2-level)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./main/\([^']*\)'|from '@main/\1'|g"
# 
# # 15. @/ - 2-level ipc_consts, vendor, etc.
# echo "  - @/ (2-level misc)"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./ipc_consts'|from '@/ipc_consts'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./vendor/\([^']*\)'|from '@/vendor/\1'|g"
# 
# # 16. @root/* - assets, defaults, locales
# echo "  - @root/assets/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./assets/\([^']*\)'|from '@root/assets/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./assets/\([^']*\)'|from '@root/assets/\1'|g"
# 
# echo "  - @root/defaults/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./defaults/\([^']*\)'|from '@root/defaults/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./defaults/\([^']*\)'|from '@root/defaults/\1'|g"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./defaults/\([^']*\)'|from '@root/defaults/\1'|g"
# 
# echo "  - @root/locales/*"
# echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./locales/\([^']*\)'|from '@root/locales/\1'|g"
# 
echo ""
echo ""
echo "📝 Phase 2: Non-import patterns (vi.mock, await import, etc.)..."

# Replace in vi.mock(), await import(), importActual(), etc.
# Use a more general pattern that matches any context
echo "  - vi.mock() and dynamic imports"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/renderer/components/\\([^']*\\)'|('@components/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/renderer/services/\\([^']*\\)'|('@services/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/renderer/\\([^']*\\)'|('@renderer/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/main/\\([^']*\\)'|('@main/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/models/\\([^']*\\)'|('@models/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/types/\\([^']*\\)'|('types/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/src/\\([^']*\\)'|('@/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/mocks/\\([^']*\\)'|('@tests/mocks/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/mocks'|('@tests/mocks'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/defaults/\\([^']*\\)'|('@root/defaults/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/assets/\\([^']*\\)'|('@root/assets/\\2'|g"
echo "$FILES" | xargs sed -i '' "s|('\\.\\.\\(/\\.\\.[^']*\\)*/locales/\\([^']*\\)'|('@root/locales/\\2'|g"

echo ""
echo "📝 Phase 3: Extra deep paths (5-6 levels)..."

# 6-level explicit patterns for from statements
echo "  - from statements (6-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/services/\\([^']*\\)'|from '@services/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/\\([^']*\\)'|from '@renderer/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/types/\\([^']*\\)'|from 'types/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/\\([^']*\\)'|from '@/\\1'|g"

# 5-level explicit patterns
echo "  - from statements (5-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/services/\\([^']*\\)'|from '@services/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/renderer/\\([^']*\\)'|from '@renderer/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/types/\\([^']*\\)'|from 'types/\\1'|g"

# Specific remaining patterns
echo "  - @root/assets/* (3-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./assets/\\([^']*\\)'|from '@root/assets/\\1'|g"

echo "  - @root/defaults/* (2-4 levels)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./defaults/\\([^']*\\)'|from '@root/defaults/\\1'|g"

echo "  - @root/locales/* (2-4 levels)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./locales/\\([^']*\\)'|from '@root/locales/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./locales/\\([^']*\\)'|from '@root/locales/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./locales/\\([^']*\\)'|from '@root/locales/\\1'|g"

echo "  - @tests/mocks/* (2-4 levels)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./mocks/\\([^']*\\)'|from '@tests/mocks/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./mocks/\\([^']*\\)'|from '@tests/mocks/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./mocks/\\([^']*\\)'|from '@tests/mocks/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./mocks'|from '@tests/mocks'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./mocks/\\([^']*\\)'|from '@tests/mocks/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./mocks'|from '@tests/mocks'|g"

echo "  - @tests/fixtures/*"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./fixtures/\\([^']*\\)'|from '@tests/fixtures/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./fixtures/\\([^']*\\)'|from '@tests/fixtures/\\1'|g"

echo "  - @tests/utils"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./utils'|from '@tests/utils'|g"

echo "  - types/* (2-level from renderer)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./types/\\([^']*\\)'|from 'types/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./types/\\([^']*\\)'|from 'types/\\1'|g"

echo "  - @models/* (3-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./models/\\([^']*\\)'|from '@models/\\1'|g"

echo "  - @renderer/utils (2-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./utils/\\([^']*\\)'|from '@renderer/utils/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./utils/\\([^']*\\)'|from '@renderer/utils/\\1'|g"

echo "  - @main/* (from renderer, 2-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./main/\\([^']*\\)'|from '@main/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./main/\\([^']*\\)'|from '@main/\\1'|g"

echo "  - @/ipc_consts (2-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./ipc_consts'|from '@/ipc_consts'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./ipc_consts'|from '@/ipc_consts'|g"

echo "  - @/vendor/* (4-6 levels)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/vendor/\\([^']*\\)'|from '@/vendor/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./vendor/\\([^']*\\)'|from '@/vendor/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./vendor/\\([^']*\\)'|from '@/vendor/\\1'|g"

echo "  - @root/tools/*"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./tools/\\([^']*\\)'|from '@root/tools/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./tools/\\([^']*\\)'|from '@root/tools/\\1'|g"

echo ""
echo "📝 Phase 4: Final cleanup - specific remaining patterns..."

echo "  - @/vendor/tavily (6-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\.\\(/\\.\\.\\.\\)\\{5\\}/src/vendor/\\([^']*\\)'|from '@/vendor/\\2'|g"

echo "  - @tests/mocks (4-level, no subpath)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./\\.\\./mocks'|from '@tests/mocks'|g"

echo "  - @tests/mocks (3-level, no subpath)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./mocks'|from '@tests/mocks'|g"

echo "  - @tests/fixtures/*"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./fixtures/\\([^']*\\)'|from '@tests/fixtures/\\1'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./fixtures/\\([^']*\\)'|from '@tests/fixtures/\\1'|g"

echo "  - @tests/utils (3-level)"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./\\.\\./utils'|from '@tests/utils'|g"
echo "$FILES" | xargs sed -i '' "s|from '\\.\\./\\.\\./utils'|from '@tests/utils'|g"

echo "  - import (not from) - tavily vendor"
echo "$FILES" | xargs sed -i '' "s|import \\([^ ]*\\) from '\\.\\./\\.\\./\\.\\./\\.\\./\\.\\./src/vendor/\\([^']*\\)'|import \\1 from '@/vendor/\\2'|g"

echo ""
echo "✅ Path replacement complete!"
echo ""
echo "Next steps:"
echo "  1. Review changes: git diff"
echo "  2. Run lint: npm run lint"
echo "  3. Run tests: npm run test:ai -- message_item"
echo "  4. If errors, restore: git restore ."
