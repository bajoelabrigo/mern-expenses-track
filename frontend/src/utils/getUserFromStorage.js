export const getUserFromStorage = () => {
  try {
    const userInfo = localStorage.getItem("userInfo");
    if (!userInfo) return null;

    const parsed = JSON.parse(userInfo);
    return parsed?.token || null;
  } catch (error) {
    console.error("Error parsing user info from storage:", error);
    return null;
  }
};
