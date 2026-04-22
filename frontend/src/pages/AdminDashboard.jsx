import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function AdminDashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  // State to manage which section the admin is currently viewing
  const [activeTab, setActiveTab] = useState("requests");
  const [pendingRequests, setPendingRequests] = useState([]);

  // --- NEW: Profile State ---
  const [profile, setProfile] = useState(null);

  // --- State for Manual Account Creation Form ---
  const [createEmail, setCreateEmail] = useState("");
  const [createMobile, setCreateMobile] = useState("");
  const [createType, setCreateType] = useState("SAVINGS");
  const [createBalance, setCreateBalance] = useState("");
  const [createInterest, setCreateInterest] = useState("");
  const [createDate, setCreateDate] = useState("");
  // --- State for Close Account Form ---
  const [closeAccountNum, setCloseAccountNum] = useState("");
  // --- State for Reactivate Account Form ---
  const [activateAccountNum, setActivateAccountNum] = useState("");

  // --- State for SQL Console ---
  const [sqlQuery, setSqlQuery] = useState("");
  const [queryResults, setQueryResults] = useState(null);
  const [queryError, setQueryError] = useState("");

  // --- State for Issue Loan Form ---
  const [loanAccountNum, setLoanAccountNum] = useState("");
  const [loanType, setLoanType] = useState("PERSONAL");
  const [loanAmount, setLoanAmount] = useState("");
  const [loanRate, setLoanRate] = useState("");
  const [loanEmis, setLoanEmis] = useState("");

  // --- Submit handler for Issuing a Loan ---
  const handleIssueLoan = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        accountNumber: loanAccountNum,
        loanType: loanType,
        baseAmount: loanAmount,
        interestRate: loanRate,
        emisLeft: loanEmis,
      };

      await api.post("/loans/issue-loan", payload);
      alert("Loan successfully issued and funds disbursed!");

      // Clear the form
      setLoanAccountNum("");
      setLoanType("PERSONAL");
      setLoanAmount("");
      setLoanRate("");
      setLoanEmis("");
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to issue loan",
      );
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  if (!role || role !== "ADMIN") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
        <p className="text-xl font-semibold text-red-600 bg-white p-8 rounded-2xl shadow-xl">
          Access Denied. Administrator privileges required.
        </p>
      </div>
    );
  }

  // --- NEW: State for DB Statistics ---
  const [dbStats, setDbStats] = useState(null);

  const fetchDbStats = async () => {
    try {
      // Update this URL if you placed the route in a different file!
      const res = await api.get("/admin/db-stats");
      setDbStats(res.data);
    } catch (err) {
      console.error("Failed to fetch DB stats", err);
    }
  };

  // --- State for Loan Requests ---
  const [pendingLoans, setPendingLoans] = useState([]);

  useEffect(() => {
    if (activeTab === "loan-requests") {
      fetchPendingLoans();
    }
  }, [activeTab]);

  const fetchPendingLoans = async () => {
    try {
      const res = await api.get("/loans/pending-loans");
      setPendingLoans(res.data);
    } catch (err) {
      console.error("Failed to fetch pending loans", err);
    }
  };

  // --- Handle Loan Actions ---
  const handleApproveLoan = async (loanId) => {
    if (
      !window.confirm(
        "Approve this loan? Funds will be transferred immediately.",
      )
    )
      return;
    try {
      await api.put(`/loans/approve-loan/${loanId}`);
      alert("Loan approved and funds disbursed!");
      fetchPendingLoans();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to approve loan",
      );
    }
  };

  const handleRejectLoan = async (loanId) => {
    if (
      !window.confirm("Are you sure you want to reject this loan application?")
    )
      return;
    try {
      await api.put(`/loans/reject-loan/${loanId}`);
      alert("Loan application rejected.");
      fetchPendingLoans();
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to reject loan",
      );
    }
  };

  // Fetch data based on the active tab
  useEffect(() => {
    if (activeTab === "requests") {
      fetchPendingRequests();
    } else if (activeTab === "profile" && !profile) {
      fetchProfile();
    } else if (activeTab === "db-stats") {
      // NEW: Fetch stats when the tab is clicked
      fetchDbStats();
    }
  }, [activeTab]);

  const fetchPendingRequests = async () => {
    try {
      const res = await api.get("/accounts/pending");
      setPendingRequests(res.data);
    } catch (err) {
      console.error("Failed to fetch requests", err);
    }
  };

  // --- Handle Raw SQL Execution ---
  const handleRunSQL = async (e) => {
    e.preventDefault();
    setQueryError("");
    setQueryResults(null);

    try {
      const res = await api.post("/admin/run-sql", { query: sqlQuery });
      setQueryResults(res.data.results);
    } catch (err) {
      setQueryError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to execute query",
      );
    }
  };

  // --- Submit handler for Reactivating an Account ---
  const handleActivateAccount = async (e) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Are you sure you want to reactivate account ${activateAccountNum}?`,
      )
    ) {
      return;
    }

    try {
      await api.put("/accounts/activate", {
        accountNumber: activateAccountNum,
      });
      alert(`Account ${activateAccountNum} reactivated successfully!`);
      setActivateAccountNum("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to reactivate account");
    }
  };

  // --- NEW: Fetch Profile Function ---
  const fetchProfile = async () => {
    try {
      const res = await api.get("/auth/profile");
      setProfile(res.data);
    } catch (err) {
      console.error("Failed to fetch profile", err);
    }
  };

  const handleApprove = async (accountId) => {
    try {
      await api.put(`/accounts/approve/${accountId}`);
      alert("Account approved and created successfully!");
      fetchPendingRequests();
    } catch (err) {
      alert(err.response?.data?.message || "Failed to approve account");
    }
  };

  // --- Submit handler for Manual Account Creation ---
  const handleCreateAccount = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        email: createEmail,
        mobileNumber: createMobile,
        accountType: createType,
        initialBalance: createBalance,
        interestRate: createInterest ? parseFloat(createInterest) : undefined,
        openingDate: createDate || undefined,
      };

      await api.post("/accounts/create-manual", payload);
      alert("Account manually created and funded successfully!");

      setCreateEmail("");
      setCreateMobile("");
      setCreateType("SAVINGS");
      setCreateBalance("");
      setCreateInterest("");
      setCreateDate("");
    } catch (err) {
      alert(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Failed to create account",
      );
    }
  };

  // --- Submit handler for Closing an Account ---
  const handleCloseAccount = async (e) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Are you sure you want to close account ${closeAccountNum}? This action cannot be undone.`,
      )
    ) {
      return;
    }

    try {
      await api.put("/accounts/close", { accountNumber: closeAccountNum });
      alert(`Account ${closeAccountNum} closed successfully!`);
      setCloseAccountNum("");
    } catch (err) {
      alert(err.response?.data?.message || "Failed to close account");
    }
  };

  // --- NEW: State for Search Directory ---
  const [searchType, setSearchType] = useState("email");
  const [searchQueryInput, setSearchQueryInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // --- NEW: Handle Directory Search ---
  // --- Handle Directory Search ---
  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQueryInput.trim()) return;

    setIsSearching(true);
    setSearchResult(null);

    try {
      let res;
      if (searchType === "email") {
        res = await api.get(`/admin/user-details/${searchQueryInput}`);
        setSearchResult({ type: "user", data: res.data });
      } else if (searchType === "account") {
        res = await api.get(
          `/admin/account-details/${searchQueryInput}`,
        );
        setSearchResult({ type: "account", data: res.data });
      } else if (searchType === "loan") {
        // NEW: Calls the new loan route!
        res = await api.get(`/admin/loan-details/${searchQueryInput}`);
        setSearchResult({ type: "loan", data: res.data });
      }
    } catch (err) {
      alert(err.response?.data?.message || "Search failed. Record not found.");
    } finally {
      setIsSearching(false);
    }
  };

  // Function to render the correct view based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      // case "requests":
      //   return (
      //     <div className="animate-fade-in">
      //       <h2 className="text-2xl font-bold text-gray-800 mb-2">
      //         Account Opening Requests
      //       </h2>
      //       <p className="text-gray-600 mb-6">
      //         Review and approve pending user applications.
      //       </p>

      //       {pendingRequests.length === 0 ? (
      //         <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500">
      //           No pending requests at the moment.
      //         </div>
      //       ) : (
      //         <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
      //           <div className="overflow-x-auto">
      //             <table className="min-w-full divide-y divide-gray-200">
      //               <thead className="bg-blue-50">
      //                 <tr>
      //                   <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
      //                     User Name
      //                   </th>
      //                   <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
      //                     Email
      //                   </th>
      //                   <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
      //                     Account Type
      //                   </th>
      //                   <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
      //                     Fee Paid
      //                   </th>
      //                   <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
      //                     Action
      //                   </th>
      //                 </tr>
      //               </thead>
      //               <tbody className="bg-white divide-y divide-gray-100">
      //                 {pendingRequests.map((req) => (
      //                   <tr
      //                     key={req.id}
      //                     className="hover:bg-gray-50 transition-colors"
      //                   >
      //                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
      //                       {req.user?.fullName}
      //                     </td>
      //                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
      //                       {req.user?.email}
      //                     </td>
      //                     <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
      //                       {req.accountType}
      //                     </td>
      //                     <td className="px-6 py-4 whitespace-nowrap text-sm">
      //                       {req.openingFeePaid ? (
      //                         <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
      //                           ✅ Yes
      //                         </span>
      //                       ) : (
      //                         <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
      //                           ❌ No
      //                         </span>
      //                       )}
      //                     </td>
      //                     <td className="px-6 py-4 whitespace-nowrap text-sm">
      //                       <button
      //                         onClick={() => handleApprove(req.id)}
      //                         className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
      //                       >
      //                         Approve
      //                       </button>
      //                     </td>
      //                   </tr>
      //                 ))}
      //               </tbody>
      //             </table>
      //           </div>
      //         </div>
      //       )}
      //     </div>
      //   );

      case "create-account":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Manual Account Creation
            </h2>
            <p className="text-gray-600 mb-6">
              Directly open an account for an existing user bypassing the
              request queue.
            </p>

            <form
              onSubmit={handleCreateAccount}
              className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-lg space-y-4 border border-gray-100"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  User Email *
                </label>
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  User Mobile Number *
                </label>
                <input
                  type="tel"
                  value={createMobile}
                  onChange={(e) => setCreateMobile(e.target.value)}
                  placeholder="10-digit number"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Account Type *
                </label>
                <select
                  value={createType}
                  onChange={(e) => setCreateType(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                >
                  <option value="SAVINGS">SAVINGS</option>
                  <option value="CURRENT">CURRENT</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Initial Balance (₹) *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={createBalance}
                  onChange={(e) => setCreateBalance(e.target.value)}
                  placeholder="0.00"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Custom Interest Rate (%)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={createInterest}
                  onChange={(e) => setCreateInterest(e.target.value)}
                  placeholder="Leave blank for defaults"
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Opening Date
                </label>
                <input
                  type="date"
                  value={createDate}
                  onChange={(e) => setCreateDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-2"
              >
                Create & Fund Account
              </button>
            </form>
          </div>
        );
      case "delete-account":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Close User Account
            </h2>
            <p className="text-gray-600 mb-6">
              Search for an account number to permanently close it.
            </p>

            <form
              onSubmit={handleCloseAccount}
              className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-md space-y-4 border border-gray-100"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Account Number to Close *
                </label>
                <input
                  type="text"
                  value={closeAccountNum}
                  onChange={(e) => setCloseAccountNum(e.target.value)}
                  placeholder="Enter 12-digit Account Number"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition shadow-md"
              >
                Find and Close Account
              </button>
            </form>
          </div>
        );
      case "activate-account":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Reactivate User Account
            </h2>
            <p className="text-gray-600 mb-6">
              Search for a closed account number to restore its access.
            </p>

            <form
              onSubmit={handleActivateAccount}
              className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-md space-y-4 border border-gray-100"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Account Number to Reactivate *
                </label>
                <input
                  type="text"
                  value={activateAccountNum}
                  onChange={(e) => setActivateAccountNum(e.target.value)}
                  placeholder="Enter 12-digit Account Number"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-green-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-md"
              >
                Find and Reactivate Account
              </button>
            </form>
          </div>
        );
      case "issue-loan":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Issue a New Loan
            </h2>
            <p className="text-gray-600 mb-6">
              Disburse a loan directly to a user's account and set up the EMI
              schedule.
            </p>

            <form
              onSubmit={handleIssueLoan}
              className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-lg space-y-4 border border-gray-100"
            >
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Receiver's Account Number *
                </label>
                <input
                  type="text"
                  value={loanAccountNum}
                  onChange={(e) => setLoanAccountNum(e.target.value)}
                  placeholder="Enter 12-digit Account Number"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Loan Type *
                </label>
                <select
                  value={loanType}
                  onChange={(e) => setLoanType(e.target.value)}
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                >
                  <option value="PERSONAL">PERSONAL</option>
                  <option value="HOME">HOME</option>
                  <option value="CAR">CAR</option>
                  <option value="EDUCATION">EDUCATION</option>
                  <option value="BUSINESS">BUSINESS</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Principal Amount (₹) *
                </label>
                <input
                  type="number"
                  min="1000"
                  step="0.01"
                  value={loanAmount}
                  onChange={(e) => setLoanAmount(e.target.value)}
                  placeholder="Minimum ₹1000"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Interest Rate (Annual %) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={loanRate}
                  onChange={(e) => setLoanRate(e.target.value)}
                  placeholder="e.g., 8.5"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">
                  Duration (Months / EMIs) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={loanEmis}
                  onChange={(e) => setLoanEmis(e.target.value)}
                  placeholder="e.g., 60 for 5 years"
                  required
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-2"
              >
                Disburse Funds & Issue Loan
              </button>
            </form>
          </div>
        );
      case "loan-requests":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Loan Applications
            </h2>
            <p className="text-gray-600 mb-6">
              Review and process user loan requests.
            </p>

            {pendingLoans.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500">
                No pending loan applications at the moment.
              </div>
            ) : (
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-blue-50">
                      <tr>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                          Loan No.
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                          Target Account
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                          Type & Amount
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                          Projected EMI
                        </th>
                        <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-100">
                      {pendingLoans.map((loan) => (
                        <tr
                          key={loan.id}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-bold">
                            {loan.loanNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {loan.accountNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {loan.loanType} <br />
                            <span className="text-green-600 font-bold text-base mt-1 block">
                              ₹{parseFloat(loan.baseAmount).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            <span className="font-semibold text-gray-900">
                              ₹{parseFloat(loan.nextEmiAmount).toFixed(2)} / mo
                            </span>
                            <br />
                            <span className="text-xs text-gray-500 mt-1 block">
                              {loan.emisLeft} Months @ {loan.interestRate}%
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                            <button
                              onClick={() => handleApproveLoan(loan.id)}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleRejectLoan(loan.id)}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-semibold transition shadow-sm"
                            >
                              Reject
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      case "sql-console":
        return (
          <div className="animate-fade-in w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Developer SQL Console
            </h2>
            <p className="text-gray-600 mb-6">
              Execute raw queries directly against the MySQL database.
            </p>

            <form onSubmit={handleRunSQL} className="mb-6 max-w-4xl">
              <textarea
                value={sqlQuery}
                onChange={(e) => setSqlQuery(e.target.value)}
                placeholder="SELECT * FROM Users LIMIT 10;"
                required
                className="w-full h-32 bg-gray-900 text-green-400 font-mono text-sm p-4 rounded-xl border border-gray-700 focus:ring-2 focus:ring-blue-500 focus:outline-none mb-4 shadow-inner"
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-md flex items-center"
              >
                <span className="mr-2">▶</span> Run Query
              </button>
            </form>

            {queryError && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow-sm mb-6 max-w-4xl">
                <p className="text-red-700 text-sm font-semibold">Error</p>
                <p className="text-red-600 mt-1 break-all">{queryError}</p>
              </div>
            )}

            {queryResults && (
              <div className="bg-white shadow-xl rounded-2xl overflow-hidden w-full">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                  <h3 className="font-bold text-gray-800">
                    Results ({queryResults.length} rows)
                  </h3>
                </div>

                {queryResults.length === 0 ? (
                  <div className="p-6 text-gray-500 text-center">
                    Query executed successfully, but returned 0 rows.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-50">
                        <tr>
                          {Object.keys(queryResults[0]).map((key) => (
                            <th
                              key={key}
                              className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase tracking-wider whitespace-nowrap"
                            >
                              {key}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100 font-mono text-sm">
                        {queryResults.map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {Object.values(row).map((val, i) => (
                              <td
                                key={i}
                                className="px-6 py-3 whitespace-nowrap text-gray-700"
                              >
                                {val === null ? (
                                  <span className="text-gray-400 italic">
                                    NULL
                                  </span>
                                ) : (
                                  String(val)
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      case "search-directory":
        return (
          <div className="animate-fade-in w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Search Directory
            </h2>
            <p className="text-gray-600 mb-6">
              Lookup comprehensive data for specific users or accounts.
            </p>

            {/* Search Form */}
            {/* Search Form */}
            <form
              onSubmit={handleSearch}
              className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-2xl space-y-4 border border-gray-100 mb-8"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="w-full sm:w-1/3">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Search By
                  </label>
                  <select
                    value={searchType}
                    onChange={(e) => {
                      setSearchType(e.target.value);
                      setSearchResult(null);
                    }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    <option value="email">User Email</option>
                    <option value="account">Account Number</option>
                    <option value="loan">Loan Number</option> {/* NEW OPTION */}
                  </select>
                </div>
                <div className="w-full sm:w-2/3">
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    {searchType === "email"
                      ? "Enter Email Address *"
                      : searchType === "account"
                        ? "Enter 12-Digit Account Number *"
                        : "Enter Loan Number (e.g., LN-12345678) *"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type={searchType === "email" ? "email" : "text"}
                      value={searchQueryInput}
                      onChange={(e) => setSearchQueryInput(e.target.value)}
                      placeholder={
                        searchType === "email"
                          ? "user@example.com"
                          : searchType === "account"
                            ? "e.g., 847291038472"
                            : "e.g., LN-84729103"
                      }
                      required
                      className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-md disabled:opacity-50"
                    >
                      {isSearching ? "..." : "Search"}
                    </button>
                  </div>
                </div>
              </div>
            </form>

            {/* Results Rendering */}
            {searchResult && searchResult.type === "user" && (
              <div className="space-y-6 animate-fade-in max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* User Info Card */}
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 md:col-span-2">
                    <h3 className="text-lg font-bold text-blue-700 border-b border-gray-100 pb-2 mb-4">
                      User Profile
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500 font-bold uppercase text-xs">
                          Name
                        </p>
                        <p className="font-semibold text-gray-800">
                          {searchResult.data.user.fullName}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-bold uppercase text-xs">
                          Email
                        </p>
                        <p className="font-semibold text-gray-800">
                          {searchResult.data.user.email}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-bold uppercase text-xs">
                          Phone
                        </p>
                        <p className="font-semibold text-gray-800">
                          {searchResult.data.user.mobileNumber}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 font-bold uppercase text-xs">
                          DOB & Gender
                        </p>
                        <p className="font-semibold text-gray-800">
                          {searchResult.data.user.dob} (
                          {searchResult.data.user.gender})
                        </p>
                      </div>
                      <div className="sm:col-span-2">
                        <p className="text-gray-500 font-bold uppercase text-xs">
                          Address
                        </p>
                        <p className="font-semibold text-gray-800">
                          {searchResult.data.user.address}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Financial Summary Card */}
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl rounded-2xl p-6 text-white border border-blue-500 flex flex-col justify-center">
                    <h3 className="text-sm uppercase tracking-wider font-bold opacity-80 mb-2">
                      Cumulative Wealth
                    </h3>
                    <p className="text-4xl font-black mb-4">
                      ₹
                      {
                        searchResult.data.financialSummary
                          .totalCumulativeBalance
                      }
                    </p>
                    <div className="flex justify-between text-sm opacity-90 border-t border-blue-400 pt-4">
                      <span>
                        {searchResult.data.financialSummary.totalAccounts}{" "}
                        Accounts
                      </span>
                      <span>
                        {searchResult.data.financialSummary.totalLoans} Loans
                      </span>
                    </div>
                  </div>
                </div>

                {/* Accounts Table */}
                <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                  <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                    <h3 className="font-bold text-gray-800">Owned Accounts</h3>
                  </div>
                  {searchResult.data.accounts.length === 0 ? (
                    <p className="p-6 text-gray-500">
                      No accounts found for this user.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Number
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {searchResult.data.accounts.map((acc) => (
                            <tr key={acc.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                {acc.accountNumber || "Pending"}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {acc.accountType}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm">
                                <span
                                  className={`px-2 py-1 text-xs font-bold rounded-md ${acc.status === "RUNNING" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                                >
                                  {acc.status}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                ₹{parseFloat(acc.balance).toFixed(2)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Loans Table */}
                {searchResult.data.loans.length > 0 && (
                  <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800">
                        Active & Past Loans
                      </h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Loan No.
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Principal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {searchResult.data.loans.map((loan) => (
                            <tr key={loan.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                {loan.loanNumber}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {loan.loanType}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                ₹{parseFloat(loan.baseAmount).toFixed(2)}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-600">
                                {loan.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {searchResult && searchResult.type === "account" && (
              <div className="space-y-6 animate-fade-in max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Account Info Card */}
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                    <h3 className="text-lg font-bold text-blue-700 border-b border-gray-100 pb-2 mb-4 flex justify-between items-center">
                      <span>Account Details</span>
                      <span
                        className={`px-2.5 py-1 text-xs font-bold rounded-md ${searchResult.data.accountDetails.status === "RUNNING" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}
                      >
                        {searchResult.data.accountDetails.status}
                      </span>
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase">
                          Account Number
                        </span>
                        <span className="font-black text-gray-900">
                          {searchResult.data.accountDetails.accountNumber}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase">
                          Type
                        </span>
                        <span className="font-semibold text-gray-800">
                          {searchResult.data.accountDetails.accountType}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase">
                          Balance
                        </span>
                        <span className="font-black text-blue-600 text-lg">
                          ₹{searchResult.data.accountDetails.balance}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase">
                          Interest Rate
                        </span>
                        <span className="font-semibold text-gray-800">
                          {searchResult.data.accountDetails.interestRate}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold uppercase">
                          Opened On
                        </span>
                        <span className="font-semibold text-gray-800">
                          {new Date(
                            searchResult.data.accountDetails.openingDate ||
                              searchResult.data.accountDetails.createdAt,
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Owner Info Card */}
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">
                      Owner Details
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase text-xs">
                          Name
                        </span>
                        <span className="font-semibold text-gray-900 text-base">
                          {searchResult.data.owner.fullName}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase text-xs">
                          Email
                        </span>
                        <span className="font-semibold text-gray-800">
                          {searchResult.data.owner.email}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span className="text-gray-500 font-bold uppercase text-xs">
                          Phone
                        </span>
                        <span className="font-semibold text-gray-800">
                          {searchResult.data.owner.mobileNumber}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Linked Loans Table */}
                {searchResult.data.linkedLoans.length > 0 && (
                  <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="bg-gray-50 border-b border-gray-200 px-6 py-4">
                      <h3 className="font-bold text-gray-800">Linked Loans</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Loan No.
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Type & Principal
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Next EMI
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-bold text-blue-800 uppercase">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {searchResult.data.linkedLoans.map((loan) => (
                            <tr key={loan.id} className="hover:bg-gray-50">
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                {loan.loanNumber}
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600">
                                {loan.loanType} <br />
                                <span className="text-green-600 font-bold">
                                  ₹{parseFloat(loan.baseAmount).toFixed(2)}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-800">
                                ₹{parseFloat(loan.nextEmiAmount).toFixed(2)}
                                <br />
                                <span className="text-xs text-gray-500 font-normal">
                                  Due: {loan.nextEmiDate || "-"}
                                </span>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm font-bold text-gray-600">
                                {loan.status}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* NEW: Loan Search Result UI */}
            {searchResult && searchResult.type === "loan" && (
              <div className="space-y-6 animate-fade-in max-w-5xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  {/* Loan Details Card */}
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                    <h3 className="text-lg font-bold text-blue-700 border-b border-gray-100 pb-2 mb-4 flex justify-between items-center">
                      <span>Loan Overview</span>
                      <span className={`px-2.5 py-1 text-xs font-bold rounded-md ${
                        searchResult.data.loanDetails.status === "ACTIVE" ? "bg-green-100 text-green-800" : 
                        searchResult.data.loanDetails.status === "PENDING" ? "bg-yellow-100 text-yellow-800" : 
                        searchResult.data.loanDetails.status === "REJECTED" ? "bg-red-100 text-red-800" : 
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {searchResult.data.loanDetails.status}
                      </span>
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Loan Number</span><span className="font-black text-gray-900">{searchResult.data.loanDetails.loanNumber}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Type</span><span className="font-semibold text-gray-800">{searchResult.data.loanDetails.loanType}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Principal</span><span className="font-black text-green-600 text-lg">₹{parseFloat(searchResult.data.loanDetails.baseAmount).toFixed(2)}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Interest Rate</span><span className="font-semibold text-gray-800">{searchResult.data.loanDetails.interestRate}%</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Next EMI</span><span className="font-semibold text-gray-800">₹{parseFloat(searchResult.data.loanDetails.nextEmiAmount).toFixed(2)} (Due: {searchResult.data.loanDetails.nextEmiDate || "N/A"})</span></div>
                      <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">EMIs Left</span><span className="font-semibold text-gray-800">{searchResult.data.loanDetails.emisLeft}</span></div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Borrower Info Card */}
                    <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Borrower Details</h3>
                      {searchResult.data.owner ? (
                        <div className="space-y-3 text-sm">
                          <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-xs">Name</span><span className="font-semibold text-gray-900 text-base">{searchResult.data.owner.fullName}</span></div>
                          <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-xs">Email</span><span className="font-semibold text-gray-800">{searchResult.data.owner.email}</span></div>
                          <div className="flex flex-col"><span className="text-gray-500 font-bold uppercase text-xs">Phone</span><span className="font-semibold text-gray-800">{searchResult.data.owner.mobileNumber}</span></div>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">Borrower data not found.</p>
                      )}
                    </div>

                    {/* Linked Account Info Card */}
                    <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                      <h3 className="text-lg font-bold text-gray-800 border-b border-gray-100 pb-2 mb-4">Linked Bank Account</h3>
                      {searchResult.data.linkedAccount ? (
                        <div className="space-y-3 text-sm">
                          <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Account Number</span><span className="font-semibold text-gray-900">{searchResult.data.linkedAccount.accountNumber}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Type</span><span className="font-semibold text-gray-800">{searchResult.data.linkedAccount.accountType}</span></div>
                          <div className="flex justify-between"><span className="text-gray-500 font-bold uppercase">Status</span><span className={`font-bold ${searchResult.data.linkedAccount.status === "RUNNING" ? "text-green-600" : "text-red-600"}`}>{searchResult.data.linkedAccount.status}</span></div>
                        </div>
                      ) : (
                        <p className="text-gray-500 italic">Linked account not found.</p>
                      )}
                    </div>
                  </div>
                  
                </div>
              </div>
            )}
          </div>
        );
      case "db-stats":
        return (
          <div className="animate-fade-in w-full">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              System Overview
            </h2>
            <p className="text-gray-600 mb-6">
              Real-time statistics of the bank's database.
            </p>

            {dbStats ? (
              <div className="space-y-6 max-w-5xl">
                {/* Users & General */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-gradient-to-br from-blue-600 to-blue-800 shadow-xl rounded-2xl p-6 text-white border border-blue-500">
                    <h3 className="text-sm uppercase tracking-wider font-bold opacity-80">
                      Total Registered Users
                    </h3>
                    <p className="text-5xl font-black mt-2">
                      {dbStats.users.total}
                    </p>
                  </div>
                  <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100 md:col-span-2">
                    <h3 className="text-lg font-bold text-blue-700 border-b border-gray-100 pb-2 mb-4">
                      Accounts Overview
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-center">
                      <div>
                        <p className="text-2xl font-black text-gray-800">
                          {dbStats.accounts.total}
                        </p>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                          Total
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-blue-600">
                          {dbStats.accounts.byType.savings}
                        </p>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                          Savings
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-blue-600">
                          {dbStats.accounts.byType.current}
                        </p>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                          Current
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-green-500">
                          {dbStats.accounts.byStatus.running}
                        </p>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                          Running
                        </p>
                      </div>
                      <div>
                        <p className="text-2xl font-black text-red-500">
                          {dbStats.accounts.byStatus.closed}
                        </p>
                        <p className="text-xs text-gray-500 font-bold uppercase mt-1">
                          Closed
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Loans Overview */}
                <div className="bg-white shadow-xl rounded-2xl p-6 border border-gray-100">
                  <h3 className="text-lg font-bold text-blue-700 border-b border-gray-100 pb-2 mb-4 flex items-center justify-between">
                    <span>Loans Overview</span>
                    <span className="bg-blue-100 text-blue-800 text-xs px-3 py-1 rounded-full">
                      Total: {dbStats.loans.total}
                    </span>
                  </h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
                    {/* By Status */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">
                        By Status
                      </h4>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-green-700 bg-green-100 px-3 py-1 rounded-md text-xs font-bold w-24 text-center">
                            ACTIVE
                          </span>
                          <span className="font-bold text-gray-800">
                            {dbStats.loans.byStatus.active}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-yellow-700 bg-yellow-100 px-3 py-1 rounded-md text-xs font-bold w-24 text-center">
                            PENDING
                          </span>
                          <span className="font-bold text-gray-800">
                            {dbStats.loans.byStatus.pending}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-700 bg-gray-200 px-3 py-1 rounded-md text-xs font-bold w-24 text-center">
                            CLOSED
                          </span>
                          <span className="font-bold text-gray-800">
                            {dbStats.loans.byStatus.closed}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-red-700 bg-red-100 px-3 py-1 rounded-md text-xs font-bold w-24 text-center">
                            REJECTED
                          </span>
                          <span className="font-bold text-gray-800">
                            {dbStats.loans.byStatus.rejected}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-red-100 bg-red-800 px-3 py-1 rounded-md text-xs font-bold w-24 text-center">
                            DEFAULTED
                          </span>
                          <span className="font-bold text-gray-800">
                            {dbStats.loans.byStatus.defaulted}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* By Type */}
                    <div>
                      <h4 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-3">
                        By Type
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase">
                            Personal
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {dbStats.loans.byType.personal}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase">
                            Home
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {dbStats.loans.byType.home}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase">
                            Car
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {dbStats.loans.byType.car}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase">
                            Business
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {dbStats.loans.byType.business}
                          </p>
                        </div>
                        <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                          <p className="text-xs text-gray-500 font-bold uppercase">
                            Education
                          </p>
                          <p className="text-xl font-black text-gray-800">
                            {dbStats.loans.byType.education}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* <button
                  onClick={fetchDbStats}
                  className="bg-white hover:bg-gray-50 text-blue-600 border border-blue-200 px-6 py-2.5 rounded-lg font-bold transition shadow-sm"
                >
                  ⟳ Refresh Statistics
                </button> */}
              </div>
            ) : (
              <div className="bg-white shadow-xl rounded-2xl p-8 max-w-2xl text-center border border-gray-100">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            )}
          </div>
        );
      case "profile":

      default:
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Administrator Profile
            </h2>
            <p className="text-gray-600 mb-6">
              Manage your secure admin credentials and view your details.
            </p>

            {profile ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8 max-w-2xl border border-gray-100">
                <h3 className="text-lg font-bold text-blue-700 border-b border-gray-200 pb-3 mb-4">
                  Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Full Name
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.fullName || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Email
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.email}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Mobile Number
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.mobileNumber || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Date of Birth
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.dob || "N/A"}
                    </p>
                  </div>
                  <div className="md:col-span-2">
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Address
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.address || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      Gender
                    </p>
                    <p className="text-gray-800 font-medium mt-1">
                      {profile.gender || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold">
                      System Role
                    </p>
                    <span className="inline-block mt-1 px-3 py-1 bg-red-100 text-red-800 font-bold text-xs rounded-full">
                      {profile.role}
                    </span>
                  </div>
                </div>

                <h3 className="text-lg font-bold text-blue-700 border-b border-gray-200 pb-3 mb-4">
                  Account Statistics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-100">
                    <p className="text-2xl font-black text-blue-700">
                      {profile.totalAccounts}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold uppercase mt-1">
                      Total Linked
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-200">
                    <p className="text-2xl font-black text-gray-800">
                      {profile.savingsAccountsCount}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold uppercase mt-1">
                      Savings
                    </p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-xl text-center border border-gray-200">
                    <p className="text-2xl font-black text-gray-800">
                      {profile.currentAccountsCount}
                    </p>
                    <p className="text-xs text-gray-600 font-semibold uppercase mt-1">
                      Current
                    </p>
                  </div>
                </div>

                {/* <button className="w-full sm:w-auto bg-gray-800 hover:bg-gray-900 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-md mt-4">
                  Change Password
                </button> */}
              </div>
            ) : (
              <div className="bg-white shadow-xl rounded-2xl p-8 max-w-2xl text-center">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                </div>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-gradient-to-br from-blue-50 to-blue-100 font-sans">
      {/* Sidebar Navigation */}
      <div className="w-full md:w-64 bg-white shadow-2xl flex flex-col md:min-h-screen z-10 shrink-0">
        <div className="text-center py-8 border-b border-gray-100 px-4">
          <h1 className="text-2xl font-black text-blue-700 leading-tight">
            Children's Bank
            <br />
            Of India
          </h1>
          <span className="inline-block mt-2 text-xs font-bold text-blue-800 bg-blue-100 px-3 py-1 rounded-full uppercase tracking-wider">
            Admin Portal
          </span>
        </div>

        <ul className="flex flex-row md:flex-col gap-1 p-4 overflow-x-auto md:overflow-y-auto flex-1 hide-scrollbar">
          {[
            // { id: "requests", label: "Account Requests" },
            { id: "create-account", label: "Create Account" },
            { id: "delete-account", label: "Close Account" },
            { id: "activate-account", label: "Reactivate Account" },
            { id: "issue-loan", label: "Issue Loan" },
            { id: "loan-requests", label: "Loan Requests" },
            { id: "sql-console", label: "SQL Console" },
            { id: "profile", label: "Admin Profile" },
            { id: "search-directory", label: "Search Directory" },
            { id: "db-stats", label: "System Overview" },
          ].map((tab) => (
            <li key={tab.id} className="min-w-fit md:min-w-0">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-200 font-semibold text-sm ${
                  activeTab === tab.id
                    ? "bg-blue-600 text-white shadow-md transform translate-x-1 md:translate-x-2"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-700"
                }`}
              >
                {tab.label}
              </button>
            </li>
          ))}
        </ul>

        <div className="p-4 border-t border-gray-100">
          <button
            onClick={handleLogout}
            className="w-full bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z"
                clipRule="evenodd"
              />
            </svg>
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-8 lg:p-10 overflow-y-auto w-full">
        <div className="max-w-6xl mx-auto">{renderContent()}</div>
      </div>

      {/* Basic custom CSS for hiding scrollbar on mobile nav */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
