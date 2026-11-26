// Reactive hook for accessing and modifying the signed-in user's profile.
import { useState, useEffect } from 'react';
import {
  getStoredUser,
  getGlobalUser,
  userListeners,
  updateCurrentUser,
  notifyUserListeners
} from '../data/userProfile';

export { updateCurrentUser, notifyUserListeners };

export function useCurrentUser() {
  const [user, setUser] = useState(() => getStoredUser() || getGlobalUser());

  useEffect(() => {
    const handleChange = (newUser) => {
      setUser(newUser);
    };
    userListeners.add(handleChange);
    return () => {
      userListeners.delete(handleChange);
    };
  }, []);

  return { currentUser: user, updateCurrentUser };
}

export default useCurrentUser;
