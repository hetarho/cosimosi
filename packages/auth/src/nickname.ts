import { VALUES } from '@cosimosi/config'

export interface NicknameValidation {
  nickname: string
  valid: boolean
  codePointLength: number
}

/**
 * Advisory client validation only. The account service remains authoritative
 * and nicknames are deliberately not unique, so this helper performs no lookup.
 */
export function validateNickname(value: string): NicknameValidation {
  const nickname = value.trim()
  const codePointLength = [...nickname].length
  return {
    nickname,
    codePointLength,
    valid:
      codePointLength >= VALUES.account.nicknameMinLength &&
      codePointLength <= VALUES.account.nicknameMaxLength,
  }
}
