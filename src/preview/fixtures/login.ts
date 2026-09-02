export const loginData = {
  title: "Inloggen",
  authMethodGroups: [
    {
      groupName: "Inloggen voor mijzelf",
      authMethods: [
        { methodName: "digid", methodNiceName: "DigiD" },
        { methodName: "yivi", methodNiceName: "Yivi" },
        { methodName: "eherkenning", methodNiceName: "eHerkenning" },
      ],
    },
    {
      groupName: "Inloggen namens iemand anders",
      authMethods: [
        { methodName: "eherkenning", methodNiceName: "eHerkenning" },
      ],
    },
  ],
};
