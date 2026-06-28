/**
 * @format
 */

// Must run before the app's module graph (protobuf needs TextEncoder/TextDecoder).
import './polyfills';

import { AppRegistry } from 'react-native';
import App from './src/app/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
