/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Universe_Time_Sync_Consent_BodyInputs */

const en_universe_time_sync_consent_body = /** @type {(inputs: Universe_Time_Sync_Consent_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`To recall, the universe's time must move to today. Diaries for the past days left unwritten can no longer be added. Continue?`)
};

const ko_universe_time_sync_consent_body = /** @type {(inputs: Universe_Time_Sync_Consent_BodyInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`회상하려면 우주 시간을 오늘로 맞춰야 해요. 그 사이 안 쓴 과거 날짜의 일기는 이후 추가할 수 없게 됩니다. 진행할까요?`)
};

/**
* | output |
* | --- |
* | "To recall, the universe's time must move to today. Diaries for the past days left unwritten can no longer be added. Continue?" |
*
* @param {Universe_Time_Sync_Consent_BodyInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const universe_time_sync_consent_body = /** @type {((inputs?: Universe_Time_Sync_Consent_BodyInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Universe_Time_Sync_Consent_BodyInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_universe_time_sync_consent_body(inputs)
	return ko_universe_time_sync_consent_body(inputs)
});