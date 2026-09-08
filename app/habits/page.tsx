"use client";

import { useState, useEffect } from "react";
import BottomNav from "@/components/BottomNav";

export default function HabitsPage() {
  const [habits, setHabits] = useState<any[]>([]);
  const [input, setInput] = useState("");

  // 1. Load habits from storage
  useEffect(() => {
    const savedHabits = localStorage.getItem("thelife-habits");
    if (savedHabits) {
      setHabits(JSON.parse(savedHabits));
    } else {
      setHabits([
        { id: 1, name: "Drink 2L of water", streak: 4, completedToday: false },
        { id: 2, name: "Read for 30 mins", streak: 12, completedToday: true },
      ]);
    }
  }, []);

  // 2. Save habits to storage
  useEffect(() => {
    if (habits.length > 0) {
      localStorage.setItem("thelife-habits", JSON.stringify(habits));
    }
  }, [habits]);

  const addHabit = () => {
    if (!input.trim()) return;
    setHabits([...habits, { id: Date.now(), name: input, streak: 0, completedToday: false }]);
    setInput("");
  };

  // Toggle completion for today
  const toggleHabit = (id: number) => {
    setHabits(habits.map(h => {
      if (h.id === id) {
        const isCompleting = !h.completedToday;
        return { 
          ...h, 
          completedToday: isCompleting, 
          streak: isCompleting ? h.streak + 1 : Math.max(0, h.streak - 1) 
        };
      }
      return h;
    }));
  };

  return (
    <main className="min-h-screen bg-gray-900 pb-24"> {/* Notice the dark background for a bolder look! */}
      {/* Header & Input Area */}
      <div className="bg-gray-800 p-6 pb-8 rounded-b-3xl border-b border-gray-700">
        <h1 className="text-3xl font-bold text-white">Habits 🔁</h1>
        <p className="text-gray-400 mt-1">Build your streaks</p>
        
        <div className="mt-6 flex gap-2">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addHabit()}
            placeholder="New daily habit..."
            className="flex-1 bg-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-orange-500 placeholder-gray-400"
          />
          <button onClick={addHabit} className="bg-orange-500 text-white px-5 rounded-xl font-bold hover:bg-orange-600 transition">Add</button>
        </div>
      </div>

      {/* Habit List */}
      <div className="p-6 space-y-4">
        {habits.map((habit) => (
          <div key={habit.id} className={`p-5 rounded-2xl border transition ${habit.completedToday ? 'bg-green-500/20 border-green-500' : 'bg-gray-800 border-gray-700'}`}>
            <div className="flex justify-between items-center mb-3">
              <h3 className={`text-lg font-bold ${habit.completedToday ? 'text-green-400' : 'text-white'}`}>{habit.name}</h3>
              <div className="flex items-center gap-1 bg-gray-900 px-3 py-1 rounded-full">
                <span className="text-orange-400 text-sm">🔥</span>
                <span className="text-white font-bold text-sm">{habit.streak}</span>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
              <div className={`h-2 rounded-full transition-all duration-500 ${habit.completedToday ? 'bg-green-500 w-full' : 'bg-orange-500 w-1/3'}`}></div>
            </div>

            <button 
              onClick={() => toggleHabit(habit.id)}
              className={`w-full py-3 rounded-xl font-bold transition ${habit.completedToday ? 'bg-green-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
            >
              {habit.completedToday ? 'Completed Today!' : 'Mark as Done'}
            </button>
          </div>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}