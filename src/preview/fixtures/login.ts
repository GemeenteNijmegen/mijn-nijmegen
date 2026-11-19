export const loginData = {
  title: 'Inloggen',
  authMethodGroups: [
    {
      groupName: 'Inloggen voor mijzelf',
      authMethods: [
        { methodName: 'digid', methodNiceName: 'DigiD' },
        { methodName: 'yivi', methodNiceName: 'Yivi' },
        { methodName: 'verid', methodNiceName: 'een identiteitsapp' },
        { methodName: 'eherkenning', methodNiceName: 'eHerkenning' },
      ],
    },
    {
      groupName: 'Inloggen namens iemand anders',
      authMethods: [
        { methodName: 'walletGemachtigd', methodNiceName: 'ID Wallet' },
        { methodName: 'digidMachtigen', methodNiceName: 'DigiD machtigen' },
      ],
    },
  ],
};
