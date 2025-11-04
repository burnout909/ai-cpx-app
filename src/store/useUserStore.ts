import { create } from "zustand";

interface UserStore {
    studentId:string; 
    setStudentId: (id:string) => void;
}

export const useUserStore = create<UserStore>((set) => ({
    studentId: "",
    setStudentId: (id: string) => set({ studentId: id }),
}))