import { useState, useEffect } from "react";
import { Layout } from "../components/Layout";
import {
  Truck,
  Clock,
  User,
  Phone,
  MapPin,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Calendar,
  FileText,
  Search,
  Filter,
  Users,
  Activity,
  X,
  Send,
  Building2,
  ChevronDown,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { Input } from "../components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../components/ui/dialog";
import { useToast } from "../hooks/use-toast";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../components/ui/tabs";

interface AmbulanceRequest {
  id: number;
  pickup_address: string;
  destination_address: string;
  emergency_type: string;
  patient_condition: string;
  contact_number: string;
  status: string;
  priority: string;
  notes: string;
  is_read?: number;
  created_at: string;
  patient_name: string;
  patient_email: string;
  patient_phone: string;
  assigned_staff_name: string;
  assigned_staff_phone?: string;
  forwarded_to_hospital_id?: number;
  customer_signup_address?: string;
  customer_signup_lat?: string;
  customer_signup_lng?: string;
}

interface Hospital {
  id: number;
  full_name: string;
  hospital_name: string;
  phone_number: string;
  state: string;
  district: string;
}

export default function AmbulanceManagement() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<AmbulanceRequest[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<AmbulanceRequest[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [activeTab, setActiveTab] = useState<"all" | "unread">("all");
  const [selectedRequest, setSelectedRequest] =
    useState<AmbulanceRequest | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [forwardDialogOpen, setForwardDialogOpen] = useState(false);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(
    null,
  );
  const [hospitalSearchTerm, setHospitalSearchTerm] = useState("");
  const [forwardingRequestId, setForwardingRequestId] = useState<number | null>(
    null,
  );
  const [isForwarding, setIsForwarding] = useState(false);

  // Cache for resolved addresses when pickup_address contains lat,lng
  const [resolvedAddresses, setResolvedAddresses] = useState<
    Record<number, string>
  >({});
  const [resolvingIds, setResolvingIds] = useState<Record<number, boolean>>({});
  const [resolvedSignupAddresses, setResolvedSignupAddresses] = useState<
    Record<number, string>
  >({});
  const [resolvingSignupIds, setResolvingSignupIds] = useState<
    Record<number, boolean>
  >({});

  const latLngRegex = /^\s*-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?\s*$/;

  const reverseGeocode = async (lat: string, lng: string) => {
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat,
      )}&lon=${encodeURIComponent(lng)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      return data.display_name || null;
    } catch (err) {
      console.error("Reverse geocode failed", err);
      return null;
    }
  };

  const resolveAddressForRequest = async (request: AmbulanceRequest) => {
    if (!request || !request.pickup_address) return;
    if (!latLngRegex.test(request.pickup_address)) return;
    if (resolvedAddresses[request.id] || resolvingIds[request.id]) return;

    setResolvingIds((s) => ({ ...s, [request.id]: true }));

    const [lat, lng] = request.pickup_address.split(",").map((v) => v.trim());
    const address = await reverseGeocode(lat, lng);

    if (address) {
      setResolvedAddresses((s) => ({ ...s, [request.id]: address }));
    }

    setResolvingIds((s) => {
      const copy = { ...s };
      delete copy[request.id];
      return copy;
    });
  };

  const resolveSignupAddressForRequest = async (request: AmbulanceRequest) => {
    if (!request) return;
    const lat = request.customer_signup_lat;
    const lng = request.customer_signup_lng;
    if (!lat || !lng) return;
    if (resolvedSignupAddresses[request.id] || resolvingSignupIds[request.id])
      return;

    setResolvingSignupIds((s) => ({ ...s, [request.id]: true }));
    const address = await reverseGeocode(lat, lng);
    if (address) {
      setResolvedSignupAddresses((s) => ({ ...s, [request.id]: address }));
    }
    setResolvingSignupIds((s) => {
      const copy = { ...s };
      delete copy[request.id];
      return copy;
    });
  };

  const fetchRequests = async (showRefreshing = false) => {
    try {
      if (showRefreshing) setRefreshing(true);

      const token = localStorage.getItem("authToken");
      if (!token) {
        console.error("No token found");
        return;
      }

      const response = await fetch("/api/ambulance", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.requests || []);
        setFilteredRequests(data.requests || []);
      } else {
        console.error("Failed to fetch ambulance requests:", response.status);
      }
    } catch (error) {
      console.error("Error fetching ambulance requests:", error);
    } finally {
      setLoading(false);
      if (showRefreshing) setRefreshing(false);
    }
  };

  const fetchHospitals = async () => {
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch("/api/ambulance/hospitals", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        setHospitals(data.hospitals || []);
      }
    } catch (error) {
      console.error("Error fetching hospitals:", error);
    }
  };

  useEffect(() => {
    fetchRequests();
    fetchHospitals();

    const interval = setInterval(() => {
      fetchRequests();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Filter requests based on search term, status, priority, and tab
  useEffect(() => {
    let filtered = requests;

    // Filter by tab
    if (activeTab === "unread") {
      filtered = filtered.filter((r) => !r.is_read);
    }

    if (searchTerm) {
      filtered = filtered.filter(
        (request) =>
          request.patient_name
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          request.emergency_type
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          request.pickup_address
            .toLowerCase()
            .includes(searchTerm.toLowerCase()) ||
          request.id.toString().includes(searchTerm),
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((request) => request.status === statusFilter);
    }

    if (priorityFilter !== "all") {
      filtered = filtered.filter(
        (request) => request.priority === priorityFilter,
      );
    }

    setFilteredRequests(filtered);
  }, [requests, searchTerm, statusFilter, priorityFilter, activeTab]);

  const handleForwardToHospital = async () => {
    if (!forwardingRequestId || !selectedHospital) {
      toast({
        title: "Error",
        description: "Please select a hospital",
        variant: "destructive",
      });
      return;
    }

    setIsForwarding(true);
    try {
      const token = localStorage.getItem("authToken");
      if (!token) return;

      const response = await fetch("/api/ambulance/forward-to-hospital", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestId: forwardingRequestId,
          hospitalId: selectedHospital.id,
        }),
      });

      if (response.ok) {
        toast({
          title: "Success",
          description: `Request forwarded to ${selectedHospital.hospital_name}`,
        });
        setForwardDialogOpen(false);
        setSelectedHospital(null);
        setHospitalSearchTerm("");
        setForwardingRequestId(null);
        fetchRequests(false);
      } else {
        const error = await response.json();
        toast({
          title: "Error",
          description: error.error || "Failed to forward request",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error forwarding request:", error);
      toast({
        title: "Error",
        description: "Failed to forward request",
        variant: "destructive",
      });
    } finally {
      setIsForwarding(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
            Pending
          </Badge>
        );
      case "forwarded_to_hospital":
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            Forwarded
          </Badge>
        );
      case "assigned":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Assigned
          </Badge>
        );
      case "on_the_way":
        return (
          <Badge variant="secondary" className="bg-orange-100 text-orange-800">
            On The Way
          </Badge>
        );
      case "completed":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Completed
          </Badge>
        );
      case "cancelled":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            Cancelled
          </Badge>
        );
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case "critical":
        return <Badge variant="destructive">Critical</Badge>;
      case "high":
        return (
          <Badge variant="secondary" className="bg-red-100 text-red-800">
            High
          </Badge>
        );
      case "normal":
        return (
          <Badge variant="secondary" className="bg-gray-100 text-gray-800">
            Normal
          </Badge>
        );
      case "low":
        return (
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            Low
          </Badge>
        );
      default:
        return <Badge variant="secondary">Normal</Badge>;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "pending":
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case "forwarded_to_hospital":
        return <Send className="w-4 h-4 text-blue-600" />;
      case "assigned":
        return <User className="w-4 h-4 text-green-600" />;
      case "on_the_way":
        return <Truck className="w-4 h-4 text-orange-600" />;
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return <Clock className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeAgo = (dateString: string) => {
    const now = new Date();
    const past = new Date(dateString);
    const diffInMinutes = Math.floor(
      (now.getTime() - past.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 60) {
      return `${diffInMinutes} minutes ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    }
  };

  const stats = {
    total: requests.length,
    unread: requests.filter((r) => !r.is_read).length,
    pending: requests.filter((r) => r.status === "pending").length,
    forwarded: requests.filter((r) => r.status === "forwarded_to_hospital")
      .length,
    assigned: requests.filter((r) => r.status === "assigned").length,
    completed: requests.filter((r) => r.status === "completed").length,
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.hospital_name
        .toLowerCase()
        .includes(hospitalSearchTerm.toLowerCase()) ||
      h.district.toLowerCase().includes(hospitalSearchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="ml-2 text-gray-600">
            Loading ambulance requests...
          </span>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Ambulance Management
            </h1>
            <p className="text-gray-600 mt-1">
              Manage and monitor all emergency ambulance requests
            </p>
          </div>
          <Button
            onClick={() => fetchRequests(true)}
            disabled={refreshing}
            className="flex items-center space-x-2"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Activity className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Total</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {stats.total}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Unread</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.unread}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Pending</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.pending}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <Send className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Forwarded</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.forwarded}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Assigned</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.assigned}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.completed}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by patient name, emergency type, or request ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="forwarded_to_hospital">
                    Forwarded
                  </SelectItem>
                  <SelectItem value="assigned">Assigned</SelectItem>
                  <SelectItem value="on_the_way">On The Way</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as "all" | "unread")}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="all">All Requests ({stats.total})</TabsTrigger>
            <TabsTrigger value="unread">
              Unread Requests ({stats.unread})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Truck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {requests.length === 0
                      ? "No Ambulance Requests"
                      : "No Matching Requests"}
                  </h3>
                  <p className="text-gray-600">
                    {requests.length === 0
                      ? "No ambulance requests have been submitted yet."
                      : "No requests match your current filters."}
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => {
                      setSelectedRequest(request);
                      setModalOpen(true);
                      resolveAddressForRequest(request);
                      resolveSignupAddressForRequest(request);
                    }}
                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer"
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Request #{request.id}
                        </h3>
                        <div className="flex gap-2">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {request.emergency_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {getTimeAgo(request.created_at)}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 truncate">
                          {request.patient_name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">
                          {request.contact_number}
                        </span>
                      </div>

                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 line-clamp-2">
                          {latLngRegex.test(request.pickup_address)
                            ? resolvedAddresses[request.id] ||
                              request.pickup_address
                            : request.pickup_address}
                        </span>
                      </div>
                    </div>

                    {request.status === "pending" && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <Button
                          size="sm"
                          variant="default"
                          className="w-full"
                          onClick={(e) => {
                            e.stopPropagation();
                            setForwardingRequestId(request.id);
                            setForwardDialogOpen(true);
                          }}
                        >
                          <Send className="w-4 h-4 mr-2" />
                          Forward to Hospital
                        </Button>
                      </div>
                    )}

                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {formatDateTime(request.created_at)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="unread" className="space-y-4">
            {filteredRequests.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-300 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    All Caught Up
                  </h3>
                  <p className="text-gray-600">
                    No unread ambulance requests at the moment.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => {
                      setSelectedRequest(request);
                      setModalOpen(true);
                      resolveAddressForRequest(request);
                      resolveSignupAddressForRequest(request);
                    }}
                    className="bg-white border border-red-200 rounded-lg p-4 hover:shadow-lg transition-shadow cursor-pointer bg-red-50"
                  >
                    <div className="mb-3">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-gray-900">
                          Request #{request.id}
                        </h3>
                        <div className="flex gap-2">
                          {getPriorityBadge(request.priority)}
                          {getStatusBadge(request.status)}
                        </div>
                      </div>
                      <p className="text-sm text-gray-600">
                        {request.emergency_type}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        {getTimeAgo(request.created_at)}
                      </p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center space-x-2">
                        <Users className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 truncate">
                          {request.patient_name}
                        </span>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Phone className="w-4 h-4 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700">
                          {request.contact_number}
                        </span>
                      </div>

                      <div className="flex items-start space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-600 line-clamp-2">
                          {latLngRegex.test(request.pickup_address)
                            ? resolvedAddresses[request.id] ||
                              request.pickup_address
                            : request.pickup_address}
                        </span>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-red-200">
                      <Button
                        size="sm"
                        variant="default"
                        className="w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          setForwardingRequestId(request.id);
                          setForwardDialogOpen(true);
                        }}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Forward to Hospital
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Forward to Hospital Dialog */}
        <Dialog open={forwardDialogOpen} onOpenChange={setForwardDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Forward to Hospital</DialogTitle>
              <DialogDescription>
                Select a hospital to forward this ambulance request to
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-700 block mb-2">
                  Search Hospitals
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Search hospital name or district..."
                    value={hospitalSearchTerm}
                    onChange={(e) => setHospitalSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="border rounded-lg max-h-64 overflow-y-auto">
                {filteredHospitals.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-500">
                    {hospitals.length === 0
                      ? "No hospitals available"
                      : "No hospitals match your search"}
                  </div>
                ) : (
                  <div className="divide-y">
                    {filteredHospitals.map((hospital) => (
                      <button
                        key={hospital.id}
                        onClick={() => setSelectedHospital(hospital)}
                        className={`w-full text-left p-3 hover:bg-gray-50 transition-colors ${
                          selectedHospital?.id === hospital.id
                            ? "bg-blue-50 border-l-4 border-blue-600"
                            : ""
                        }`}
                      >
                        <div className="flex items-start space-x-2">
                          <Building2 className="w-4 h-4 text-gray-500 mt-1 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">
                              {hospital.hospital_name}
                            </p>
                            <p className="text-sm text-gray-600">
                              {hospital.district}, {hospital.state}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {hospital.phone_number}
                            </p>
                          </div>
                          {selectedHospital?.id === hospital.id && (
                            <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedHospital && (
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm font-medium text-blue-900">
                    Selected: {selectedHospital.hospital_name}
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                variant="outline"
                onClick={() => {
                  setForwardDialogOpen(false);
                  setSelectedHospital(null);
                  setHospitalSearchTerm("");
                  setForwardingRequestId(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleForwardToHospital}
                disabled={!selectedHospital || isForwarding}
              >
                {isForwarding ? "Forwarding..." : "Forward Request"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Request Details Modal */}
        <Dialog
          open={modalOpen}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) setSelectedRequest(null);
          }}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Request Details</DialogTitle>
            </DialogHeader>

            <div className="p-6 space-y-6">
              {selectedRequest && (
                <>
                  <div>
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      Request #{selectedRequest.id} -{" "}
                      {selectedRequest.emergency_type}
                    </h3>
                    <div className="flex items-center gap-3">
                      {getStatusIcon(selectedRequest.status)}
                      <span className="text-gray-600">
                        {formatDateTime(selectedRequest.created_at)}
                      </span>
                      <span className="text-gray-500 text-sm">•</span>
                      <span className="text-gray-600">
                        {getTimeAgo(selectedRequest.created_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {getPriorityBadge(selectedRequest.priority)}
                      {getStatusBadge(selectedRequest.status)}
                    </div>
                  </div>

                  <Separator />

                  <div className="bg-blue-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-2 mb-3">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span className="font-semibold text-blue-900">
                        Patient Information
                      </span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium text-blue-800">
                          Name:{" "}
                        </span>
                        <span className="text-blue-700">
                          {selectedRequest.patient_name}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">
                          Email:{" "}
                        </span>
                        <span className="text-blue-700">
                          {selectedRequest.patient_email}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">
                          Phone:{" "}
                        </span>
                        <span className="text-blue-700">
                          {selectedRequest.patient_phone}
                        </span>
                      </div>
                      <div>
                        <span className="font-medium text-blue-800">
                          Contact:{" "}
                        </span>
                        <span className="text-blue-700">
                          {selectedRequest.contact_number}
                        </span>
                      </div>
                    </div>
                  </div>

                  {selectedRequest.patient_condition && (
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <div className="flex items-center space-x-2 mb-2">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <span className="font-semibold text-gray-900">
                          Patient Condition
                        </span>
                      </div>
                      <p className="text-gray-700">
                        {selectedRequest.patient_condition}
                      </p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="font-medium text-gray-900">
                          Pickup Address
                        </span>
                      </div>
                      <div className="ml-6">
                        <p className="text-gray-600">
                          {latLngRegex.test(selectedRequest.pickup_address)
                            ? resolvedAddresses[selectedRequest.id] ||
                              selectedRequest.pickup_address
                            : selectedRequest.pickup_address}
                        </p>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <MapPin className="w-4 h-4 text-purple-500" />
                        <span className="font-medium text-gray-900">
                          Signup Address
                        </span>
                      </div>
                      <p className="text-gray-600 ml-6">
                        {selectedRequest.customer_signup_lat &&
                        selectedRequest.customer_signup_lng
                          ? resolvedSignupAddresses[selectedRequest.id] ||
                            `${selectedRequest.customer_signup_lat},${selectedRequest.customer_signup_lng}`
                          : selectedRequest.customer_signup_address ||
                            "Not available"}
                      </p>
                    </div>

                    {selectedRequest.destination_address && (
                      <div>
                        <div className="flex items-center space-x-2 mb-1">
                          <MapPin className="w-4 h-4 text-blue-500" />
                          <span className="font-medium text-gray-900">
                            Destination
                          </span>
                        </div>
                        <p className="text-gray-600 ml-6">
                          {selectedRequest.destination_address}
                        </p>
                      </div>
                    )}
                  </div>

                  {selectedRequest.assigned_staff_name && (
                    <>
                      <Separator />
                      <div className="bg-green-50 p-4 rounded-lg">
                        <div className="flex items-center space-x-2 mb-3">
                          <User className="w-5 h-5 text-green-600" />
                          <span className="font-semibold text-green-900">
                            Assigned Staff
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div>
                            <span className="font-medium text-green-800">
                              Name:{" "}
                            </span>
                            <span className="text-green-700">
                              {selectedRequest.assigned_staff_name}
                            </span>
                          </div>
                          {selectedRequest.assigned_staff_phone && (
                            <div>
                              <span className="font-medium text-green-800">
                                Phone:{" "}
                              </span>
                              <span className="text-green-700">
                                {selectedRequest.assigned_staff_phone}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end space-x-2 px-6 pb-6">
              <Button
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  setSelectedRequest(null);
                }}
              >
                Close
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
