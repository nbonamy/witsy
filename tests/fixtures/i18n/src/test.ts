// Test source file with i18n usage
export function testFunction() {
  // These keys should be detected as used
  const message1 = t('wrong_linked')
  const message2 = t('missing_linked')
  const message3 = t('changed_english')
  const message4 = t('missing_key')
  const message5 = $t('normal_key')
  const message6 = t('common.ok')

  return { message1, message2, message3, message4, message5, message6 }
}