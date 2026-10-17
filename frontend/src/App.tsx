import { Route, Routes } from "react-router-dom";

import AdminLayout from "./layouts/AdminLayout";
import CustomerLayout from "./layouts/CustomerLayout";
import PublicLayout from "./layouts/PublicLayout";

import ProtectedRoute from "./routes/ProtectedRoute";
import RoleRoute from "./routes/RoleRoute";

import AdminDashboard from "./pages/admin/Dashboard";
import CustomerDashboard from "./pages/customer/Dashboard";

import Home from "./pages/public/Home";
import Login from "./pages/public/Login";
import Register from "./pages/public/Register";
import VerifyEmail from "./pages/public/VerifyEmail";
import Privacy from "./pages/public/Privacy";
import Terms from "./pages/public/Terms";
import Content from "./pages/public/Content";
import ContentDetail from "./pages/public/ContentDetail";
import NotFound from "./pages/public/NotFound";

import CustomerProfile from "./pages/customer/Profile";
import CustomerAppointments from "./pages/customer/Appointments";
import CustomerExercises from "./pages/customer/Exercises";
import Customers from "./pages/admin/Customers";
import CustomerDetails from "./pages/admin/CustomerDetails";
import AdminExercises from "./pages/admin/Exercises";
import AdminVideos from "./pages/admin/videos";
import CustomerVideos from "./pages/customer/videos";
import CustomerCalories from "./pages/customer/Calories";
import CustomerWater from "./pages/customer/Water";
import CustomerPayments from "./pages/customer/Payments";
import CustomerPlans from "./pages/customer/Plans";
import PersonalizedVideos from "./pages/admin/PersonalizedVideos";
import AdminContent from "./pages/admin/Content";
import AdminAppointments from "./pages/admin/Appointments";
import AdminPlans from "./pages/admin/Plans";

function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/content" element={<Content />} />
        <Route path="/content/:slug" element={<ContentDetail />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="*" element={<NotFound />} />
      </Route>

      {/* Customer */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["CUSTOMER"]} />}>
          <Route path="/dashboard" element={<CustomerLayout />}>
            <Route index element={<CustomerDashboard />} />
            <Route path="profile" element={<CustomerProfile />} />
            <Route path="appointments" element={<CustomerAppointments />} />
            <Route path="exercises" element={<CustomerExercises />} />
            <Route path="videos" element={<CustomerVideos />} />
            <Route path="calories" element={<CustomerCalories />} />
            <Route path="water" element={<CustomerWater />} />
            <Route path="plans" element={<CustomerPlans />} />
            <Route path="payments" element={<CustomerPayments />} />
          </Route>
        </Route>
      </Route>

      {/* Dietician */}
      <Route element={<ProtectedRoute />}>
        <Route element={<RoleRoute allowedRoles={["DIETICIAN"]} />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />

            <Route path="customers" element={<Customers />} />

            <Route
              path="appointments"
              element={<AdminAppointments />}
            />

            <Route path="plans" element={<AdminPlans />} />

            <Route
              path="customers/:id"
              element={<CustomerDetails />}
            />

            <Route path="exercises" element={<AdminExercises />} />
            <Route path="videos" element={<AdminVideos />} />
            <Route path="videos/personalized" element={<PersonalizedVideos />} />
            <Route path="content" element={<AdminContent />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;