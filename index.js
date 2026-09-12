import 'react-native-get-random-values';
import React from 'react';
import { registerRootComponent } from 'expo';

import App from './App';
import ErrorBoundary from './ErrorBoundary';

// Journalise les erreurs JS non capturées par le rendu React (ex: dans un event handler
// ou une Promise) - sans appareil branché ni crash reporting, c'est la seule trace qu'on
// ait d'un crash au démarrage d'un build standalone.
if (global.ErrorUtils) {
  const previousHandler = global.ErrorUtils.getGlobalHandler
    ? global.ErrorUtils.getGlobalHandler()
    : null;
  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    console.error(`[GlobalError] ${isFatal ? 'FATAL' : 'non-fatal'} :`, error);
    if (previousHandler) previousHandler(error, isFatal);
  });
}

function Root() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(Root);
