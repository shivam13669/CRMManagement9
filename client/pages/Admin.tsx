import { useEffect, useMemo, useState } from "react";
import { Layout } from "../components/Layout";
import { CreateAdminUser } from "../components/CreateAdminUser";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import { Alert, AlertDescription } from "../components/ui/alert";
import { authUtils } from "../lib/api";
import {
  Users,
  UserCheck,
  Eye,
  MoreVertical,
  ShieldOff,
  Trash2,
  KeyRound,
  CheckCircle,
  XCircle,
  Search,
} from "lucide-react";

interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  full_name: string;
  phone?: string;
  status: "active" | "suspended";
  created_at: string;
  updated_at: string;
}

export default function AdminPage() {
  const currentUser = authUtils.getCurrentUser();

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <UserCheck className="h-8 w-8" />
              Admin Management
            </h1>
            <p className="text-gray-600 mt-2">Create and manage admin users</p>
          </div>
        </div>

        <AdminTabs />
      </div>
    </Layout>
  );
}

function AdminTabs() {
  const [activeTab, setActiveTab] = useState("create");
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="create" className="flex items-center gap-2">
          <UserCheck className="h-4 w-4" /> Create Admin
        </TabsTrigger>
        <TabsTrigger value="manage" className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Manage Admins
        </TabsTrigger>
      </TabsList>

      <TabsContent value="create">
        <CreateAdminUser />
      </TabsContent>

      <TabsContent value="manage">
        <ManageAdmins />
      </TabsContent>
    </Tabs>
  );
}

function ManageAdmins() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [pwdUser, setPwdUser] = useState<AdminUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    fetchAdmins();
  }, []);

  useEffect(() => {
    if (alert) {
      const t = setTimeout(() => setAlert(null), 4000);
      return () => clearTimeout(t);
    }
  }, [alert]);

  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/admin-users", {
        headers: { Authorization: `Bearer ${localStorage.getItem("authToken")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data.users || []);
      } else {
        setAlert({ type: "error", message: "Failed to load admins" });
      }
    } catch (e) {
      setAlert({ type: "error", message: "Network error" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return admins.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q),
    );
  }, [admins, search]);

  const submitPassword = async () => {
    if (!pwdUser) return;
    if (!newPassword || !confirmPassword) {
      setAlert({ type: "error", message: "Both fields are required" });
      return;
    }
    if (newPassword.length < 6) {
      setAlert({ type: "error", message: "Password must be at least 6 characters" });
      return;
    }
    if (newPassword !== confirmPassword) {
      setAlert({ type: "error", message: "Passwords do not match" });
      return;
    }

    try {
      setSavingPwd(true);
      const res = await fetch(`/api/admin/users/${pwdUser.id}/set-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("authToken")}`,
        },
        body: JSON.stringify({ newPassword, confirmPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAlert({ type: "error", message: data.error || "Failed to update password" });
        return;
      }
      setAlert({ type: "success", message: "Password updated successfully" });
      setPwdUser(null);
      setNewPassword("");
      setConfirmPassword("");
    } catch (e) {
      setAlert({ type: "error", message: "Network error" });
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 text-center">Loading...</CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {alert && (
        <Alert variant={alert.type === "error" ? "destructive" : "default"}>
          {alert.type === "success" ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
          <AlertDescription>{alert.message}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Admin Users
          </CardTitle>
          <CardDescription>View and manage administrator accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                placeholder="Search by name, email, or username..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button variant="outline" onClick={fetchAdmins}>Refresh</Button>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left p-4 font-medium text-gray-900">User</th>
                  <th className="text-left p-4 font-medium text-gray-900">Status</th>
                  <th className="text-left p-4 font-medium text-gray-900">Joined</th>
                  <th className="text-right p-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length > 0 ? (
                  filtered.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{user.full_name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={user.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}>
                          {user.status === "active" ? "Active" : "Suspended"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="text-sm text-gray-900">{new Date(user.created_at).toLocaleDateString()}</div>
                        <div className="text-xs text-gray-500">{new Date(user.created_at).toLocaleTimeString()}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <Dialog>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setSelectedUser(user);
                                    }}
                                  >
                                    <Eye className="w-4 h-4 mr-2" /> View Details
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Admin Details</DialogTitle>
                                    <DialogDescription>Complete information about {selectedUser?.full_name}</DialogDescription>
                                  </DialogHeader>
                                  {selectedUser && (
                                    <div className="space-y-4 text-sm">
                                      <div><span className="text-gray-500">Name:</span> {selectedUser.full_name}</div>
                                      <div><span className="text-gray-500">Email:</span> {selectedUser.email}</div>
                                      <div><span className="text-gray-500">Username:</span> @{selectedUser.username}</div>
                                      <div><span className="text-gray-500">Status:</span> {selectedUser.status}</div>
                                      <div><span className="text-gray-500">User ID:</span> #{selectedUser.id}</div>
                                    </div>
                                  )}
                                </DialogContent>
                              </Dialog>

                              <DropdownMenuSeparator />

                              <Dialog open={!!pwdUser && pwdUser.id === user.id} onOpenChange={(open) => {
                                if (!open) setPwdUser(null);
                              }}>
                                <DialogTrigger asChild>
                                  <DropdownMenuItem
                                    onSelect={(e) => {
                                      e.preventDefault();
                                      setPwdUser(user);
                                    }}
                                  >
                                    <KeyRound className="w-4 h-4 mr-2" /> Change Password
                                  </DropdownMenuItem>
                                </DialogTrigger>
                                <DialogContent>
                                  <DialogHeader>
                                    <DialogTitle>Change Password</DialogTitle>
                                    <DialogDescription>
                                      Set a new password for {pwdUser?.full_name}. Current password is not required.
                                    </DialogDescription>
                                  </DialogHeader>
                                  <div className="space-y-3">
                                    <Input
                                      type="password"
                                      placeholder="New password (min 6 characters)"
                                      value={newPassword}
                                      onChange={(e) => setNewPassword(e.target.value)}
                                    />
                                    <Input
                                      type="password"
                                      placeholder="Confirm new password"
                                      value={confirmPassword}
                                      onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                    <div className="flex gap-2 pt-2">
                                      <Button onClick={submitPassword} disabled={savingPwd} className="flex-1">
                                        {savingPwd ? "Saving..." : "Update Password"}
                                      </Button>
                                      <Button
                                        variant="outline"
                                        onClick={() => {
                                          setPwdUser(null);
                                          setNewPassword("");
                                          setConfirmPassword("");
                                        }}
                                        className="flex-1"
                                      >
                                        Cancel
                                      </Button>
                                    </div>
                                  </div>
                                </DialogContent>
                              </Dialog>

                              <DropdownMenuSeparator />

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <DropdownMenuItem disabled>
                                        <ShieldOff className="w-4 h-4 mr-2" /> Suspend Admin
                                      </DropdownMenuItem>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Not allowed for admin accounts</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>

                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <DropdownMenuItem disabled className="text-red-600 focus:text-red-600">
                                        <Trash2 className="w-4 h-4 mr-2" /> Delete Admin
                                      </DropdownMenuItem>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>Not allowed for admin accounts</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-gray-500">
                      No admins found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="text-sm text-gray-700 mt-4">Showing {filtered.length} of {admins.length} admins</div>
        </CardContent>
      </Card>
    </div>
  );
}
