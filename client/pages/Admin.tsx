import { Layout } from "../components/Layout";
import { CreateAdminUser } from "../components/CreateAdminUser";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { authUtils } from "../lib/api";
import { UserCheck } from "lucide-react";

export default function AdminPage() {
  const currentUser = authUtils.getCurrentUser();

  // Redirect to dashboard if user is not an admin
  if (currentUser?.role !== "admin") {
    return (
      <Layout>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Access Denied
            </CardTitle>
            <CardDescription>
              This page is only accessible to administrators.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              You do not have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <UserCheck className="h-8 w-8" />
            Admin Management
          </h1>
          <p className="text-gray-600 mt-2">Manage system administrators</p>
        </div>

        {/* Create Admin User Form */}
        <CreateAdminUser />
      </div>
    </Layout>
  );
}
