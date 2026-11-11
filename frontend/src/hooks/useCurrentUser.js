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
    const fresh = getStoredUser();
    if (JSON.stringify(fresh) !== JSON.stringify(user)) {
      setUser(fresh);
    }

    const handleChange = (newUser) => {
      setUser(newUser);
    };
    userListeners.add(handleChange);
    return () => {
      userListeners.delete(handleChange);
    };
  }, [user]);

  return { currentUser: user, updateCurrentUser };
}

export default useCurrentUser;
