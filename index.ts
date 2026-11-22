// The app (Expo Router), plus the widget's quick-add window as a second root component: the
// native QuickAddActivity (modules/quick-add) renders "QuickAdd" over the home screen.
import 'expo-router/entry';

import { AppRegistry } from 'react-native';

import { QuickAddRoot } from './src/quick-add/QuickAddRoot';

AppRegistry.registerComponent('QuickAdd', () => QuickAddRoot);
