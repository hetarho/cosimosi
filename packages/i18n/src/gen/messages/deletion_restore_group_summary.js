/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{ count: NonNullable<unknown> }} Deletion_Restore_Group_SummaryInputs */

const en_deletion_restore_group_summary = /** @type {(inputs: Deletion_Restore_Group_SummaryInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`Removed ${i?.count} stars.`)
};

const ko_deletion_restore_group_summary = /** @type {(inputs: Deletion_Restore_Group_SummaryInputs) => LocalizedString} */ (i) => {
	return /** @type {LocalizedString} */ (`별 ${i?.count}개를 지웠어요.`)
};

/**
* | output |
* | --- |
* | "Removed {count} stars." |
*
* @param {Deletion_Restore_Group_SummaryInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const deletion_restore_group_summary = /** @type {((inputs: Deletion_Restore_Group_SummaryInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Deletion_Restore_Group_SummaryInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_deletion_restore_group_summary(inputs)
	return ko_deletion_restore_group_summary(inputs)
});