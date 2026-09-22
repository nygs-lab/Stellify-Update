import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import SpiritualTracker from "./spiritual";
import PersonalTracker from "./personal";
import SharingTracker from "./sharing";

export default function DiscipleHub() {
  return (
    <Tabs defaultValue="spiritual" className="w-full max-w-5xl mx-auto">
      <TabsList className="grid w-full grid-cols-3 mb-6">
        <TabsTrigger value="spiritual">Spiritual Habits</TabsTrigger>
        <TabsTrigger value="personal">Personal Habits</TabsTrigger>
        <TabsTrigger value="sharing">Sharing Habits</TabsTrigger>
      </TabsList>

      <TabsContent value="spiritual">
        <SpiritualTracker />
      </TabsContent>

      <TabsContent value="personal">
        <PersonalTracker />
      </TabsContent>

      <TabsContent value="sharing">
        <SharingTracker />
      </TabsContent>
    </Tabs>
  );
}
