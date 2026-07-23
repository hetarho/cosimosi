/* eslint-disable */
import { getLocale, experimentalStaticLocale } from '../runtime.js';

/** @typedef {import('../runtime.js').LocalizedString} LocalizedString */

/** @typedef {{}} Admin_Users_SeedInputs */

const en_admin_users_seed = /** @type {(inputs: Admin_Users_SeedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`Seed`)
};

const ko_admin_users_seed = /** @type {(inputs: Admin_Users_SeedInputs) => LocalizedString} */ () => {
	return /** @type {LocalizedString} */ (`시드`)
};

/**
* | output |
* | --- |
* | "Seed" |
*
* @param {Admin_Users_SeedInputs} inputs
* @param {{ locale?: "en" | "ko" }} options
* @returns {LocalizedString}
*/
export const admin_users_seed = /** @type {((inputs?: Admin_Users_SeedInputs, options?: { locale?: "en" | "ko" }) => LocalizedString) & import('../runtime.js').MessageMetadata<Admin_Users_SeedInputs, { locale?: "en" | "ko" }, {}>} */ ((inputs = {}, options = {}) => {
	const locale = experimentalStaticLocale ?? options.locale ?? getLocale()
	if (locale === "en") return en_admin_users_seed(inputs)
	return ko_admin_users_seed(inputs)
});