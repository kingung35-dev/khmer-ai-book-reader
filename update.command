#!/bin/bash
# ==============================================================================
# Khmer AI Book Reader - 1-Click Update Script for Mac & Cloud
# រត់ស្វ័យប្រវត្តិនូវការ Bump Version, រក្សាទុក និង Push ទៅកាន់ GitHub & Render.com
# ==============================================================================

cd "$(dirname "$0")"

echo "=========================================================="
echo "  📖 Khmer AI Book Reader — កម្មវិធី Update ស្វ័យប្រវត្តិ"
echo "=========================================================="
echo ""

# បង្ហាញឯកសារដែលបានកែប្រែ
echo "🔍 កំពុងពិនិត្យឯកសារដែលបានកែប្រែ..."
git status -s

echo ""
read -p "📝 សូមបញ្ចូលចំណាំ Update (ឬចុច Enter យកទូទៅ): " msg
if [ -z "$msg" ]; then
  msg="Update: $(date '+%Y-%m-%d %H:%M:%S')"
fi

echo ""
echo "⚙️ កំពុងដំណើរការ Auto-Bump Version..."
bump_output=$(node scripts/bump-version.js "$msg")

# ទាញយកលេខ version ថ្មី
if [[ $bump_output =~ BUMPED:([^:]+):([^:]+) ]]; then
  NEW_VERSION="${BASH_REMATCH[1]}"
  BUILD_TAG="${BASH_REMATCH[2]}"
  echo "🚀 កំណែថ្មីដែលបានបង្កើត៖ v$NEW_VERSION (Build $BUILD_TAG)"
else
  NEW_VERSION="new"
  echo "🚀 បានកែសម្រួលកំណែកម្មវិធីរួចរាល់!"
fi

echo ""
echo "📤 កំពុង Upload កំណែ v$NEW_VERSION ទៅកាន់ GitHub & Render.com..."
git add .
git commit -m "Update v$NEW_VERSION: $msg" || echo "គ្មានការកែប្រែថ្មីទេ"
git push origin main

echo ""
echo "=========================================================="
echo "  ✅ UPDATE & DEPLOY ជោគជ័យ ១០០%!"
echo "=========================================================="
echo "  📌 កំណែផ្លូវការថ្មី៖ v$NEW_VERSION"
echo "  🌐 Cloud (Render.com)៖ កំពុង Auto-Deploy រយៈពេលប្រហែល ១ នាទី"
echo "  📱 លើទូរស័ព្ទដៃ៖"
echo "     1. បើក Browser ឬ Web App ឡើងវិញ"
echo "     2. អ្នកនឹងឃើញផ្ទាំងលោត៖ '🎉 មានកំណែថ្មី v$NEW_VERSION [Update ឥឡូវនេះ]'"
echo "     3. ឬចុច '⚙️ ការកំណត់' -> '🔄 ពិនិត្យ Update & ផ្ទុកឡើងវិញ'"
echo "     4. ស្លាក Version Badge (v$NEW_VERSION) នឹងបង្ហាញនៅជាប់ឈ្មោះកម្មវិធីភ្លាមៗ!"
echo "  💻 លើ Mac៖ ដំណើរការតាម start.command ដូចធម្មតា"
echo "=========================================================="
echo ""
read -p "ចុច Enter ដើម្បីចាកចេញ..."
