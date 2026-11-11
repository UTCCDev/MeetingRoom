// Notification hooks for service requests. Filled in by a later task.
export const notifyNewRequest = async (id: string): Promise<void> => {};
export const notifyDecision = async (id: string): Promise<void> => {};
export const notifyAssigned = async (id: string): Promise<void> => {};
export const notifyCancelled = async (id: string): Promise<void> => {};
