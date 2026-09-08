import BottomNav from "@/components/BottomNav";

export default function TasksPage() {
  return (
    <main className="min-h-screen bg-gray-50 pb-24">
      <div className="bg-white p-6 pb-8 shadow-sm rounded-b-3xl">
        <h1 className="text-3xl font-bold text-gray-800">Tasks ✅</h1>
        <p className="text-gray-500 mt-1">Get things done</p>
      </div>
      <div className="p-6">
        <p className="text-gray-600">Your to-do list goes here.</p>
      </div>
      <BottomNav />
    </main>
  );
}