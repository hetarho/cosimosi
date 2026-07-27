/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Me_Stardust_Reason_Admin_GrantInputs */

const en_me_stardust_reason_admin_grant = /** @type {(inputs: Me_Stardust_Reason_Admin_GrantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`A gift you received`)
};

const ko_me_stardust_reason_admin_grant = /** @type {(inputs: Me_Stardust_Reason_Admin_GrantInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`받은 선물`)
};

/**
* | output |
* | --- |
* | "A gift you received" |
*
* @param {Me_Stardust_Reason_Admin_GrantInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const me_stardust_reason_admin_grant = /** @type {((inputs?: Me_Stardust_Reason_Admin_GrantInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Me_Stardust_Reason_Admin_GrantInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_me_stardust_reason_admin_grant(inputs)
	return ko_me_stardust_reason_admin_grant(inputs)
});