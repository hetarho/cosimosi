/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Writing_Flow_Past_Date_NoticeInputs */

const en_writing_flow_past_date_notice = /** @type {(inputs: Writing_Flow_Past_Date_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`This date is ahead of your universe's present, so it's kept as a diary without lighting a star.`)
};

const ko_writing_flow_past_date_notice = /** @type {(inputs: Writing_Flow_Past_Date_NoticeInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`이 날짜는 우주의 지금보다 앞서 있어, 별을 띄우지 않고 일기로만 보관돼요.`)
};

/**
* | output |
* | --- |
* | "This date is ahead of your universe's present, so it's kept as a diary without lighting a star." |
*
* @param {Writing_Flow_Past_Date_NoticeInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const writing_flow_past_date_notice = /** @type {((inputs?: Writing_Flow_Past_Date_NoticeInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Writing_Flow_Past_Date_NoticeInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_writing_flow_past_date_notice(inputs)
	return ko_writing_flow_past_date_notice(inputs)
});