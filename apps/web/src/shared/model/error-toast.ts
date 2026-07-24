// The error-toast context + hook are shared verbatim across web and mobile — re-exported from
// @cosimosi/errors/react (promote-on-reuse). Only WebErrorProvider (the component that renders the
// DOM Toast) stays forked in the app layer.
export { ErrorToastContext, useErrorToast, type ShowErrorToast } from '@cosimosi/errors/react'
