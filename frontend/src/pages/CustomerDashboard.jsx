import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";

export default function CustomerDashboard() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  // UI State
  const [activeTab, setActiveTab] = useState("account-info");

  // --- State for Paying EMI ---
  const [payingLoan, setPayingLoan] = useState(null);
  const [emiPayFromAccountId, setEmiPayFromAccountId] = useState("");

  // Data State
  const [myAccounts, setMyAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  // --- NEW: Loans State ---
  const [loans, setLoans] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [profile, setProfile] = useState(null);

  // --- Transfer Form State ---
  const [transferFromAccountId, setTransferFromAccountId] = useState("");
  const [transferToAccountNum, setTransferToAccountNum] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");

  // --- Account Closure State ---
  const [accountToCloseNum, setAccountToCloseNum] = useState("");

  // --- State for Requesting a Loan ---
  const [reqLoanAccountNum, setReqLoanAccountNum] = useState("");
  const [reqLoanType, setReqLoanType] = useState("PERSONAL");
  const [reqLoanAmount, setReqLoanAmount] = useState("");
  const [reqLoanEmis, setReqLoanEmis] = useState("");

  // Extra security check: Kick out anyone who isn't a CUSTOMER
  if (!role || role !== "CUSTOMER") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-100 to-blue-200">
        <p className="text-xl font-semibold text-red-600 bg-white p-8 rounded-2xl shadow-xl">
          Access Denied. Please login as a customer.
        </p>
      </div>
    );
  }

  // 1. Fetch user accounts when the dashboard loads
  useEffect(() => {
    fetchMyAccounts();
  }, []);

  // 2. Fetch transactions, loans, OR profile based on the active tab
  useEffect(() => {
    if (activeTab === "transactions" && selectedAccountId) {
      fetchTransactions(selectedAccountId);
    } else if (activeTab === "loans" && selectedAccountId) {
      // Find the actual 12-digit account number to pass to the backend
      const selectedAcc = myAccounts.find(
        (acc) => acc.id === selectedAccountId,
      );
      if (selectedAcc && selectedAcc.accountNumber) {
        fetchLoans(selectedAcc.accountNumber);
      } else {
        setLoans([]); // Clear if the account doesn't have a number yet
      }
    } else if (activeTab === "profile" && !profile) {
      fetchProfile();
    }
  }, [activeTab, selectedAccountId, myAccounts]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/");
  };

  // --- Handle Loan Request ---
  const handleRequestLoan = async (e) => {
    e.preventDefault();

    const finalAccountNum =
      reqLoanAccountNum || activeAccountsList[0]?.accountNumber;

    if (!finalAccountNum) {
      alert("You need an active account to request a loan.");
      return;
    }

    // --- NEW: Add the Confirmation prompt here ---
    if (
      !window.confirm(
        "A non-refundable processing fee of ₹20.00 will be deducted from your account. Do you wish to proceed?",
      )
    ) {
      return;
    }

    try {
      await api.post("/loans/request-loan", {
        accountNumber: finalAccountNum,
        loanType: reqLoanType,
        baseAmount: reqLoanAmount,
        emisLeft: reqLoanEmis,
      });

      alert("Loan requested successfully! It is now pending Admin approval.");

      // Reset form and go to Loans tab to see the pending loan
      setReqLoanAccountNum("");
      setReqLoanType("PERSONAL");
      setReqLoanAmount("");
      setReqLoanEmis("");

      await fetchLoans(finalAccountNum);
      setActiveTab("loans");
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to request loan.",
      );
    }
  };

  // --- Handle EMI Payment ---
  const handlePayEmi = async (e) => {
    e.preventDefault();
    if (
      !window.confirm(
        `Confirm payment of ₹${payingLoan.nextEmiAmount} for Loan ${payingLoan.loanNumber}?`,
      )
    ) {
      return;
    }

    try {
      await api.post("/loans/pay-emi", {
        loanId: payingLoan.id,
        fromAccountId: emiPayFromAccountId,
      });

      alert("EMI Paid Successfully!");

      // Reset state and fetch fresh data
      setPayingLoan(null);
      await fetchMyAccounts(); // Updates their bank balance
      await fetchLoans(payingLoan.accountNumber); // Updates the loan's EMIs left
      setActiveTab("loans"); // Send them back to the loans table
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to pay EMI.",
      );
    }
  };

  const fetchMyAccounts = async () => {
    try {
      const res = await api.get("/accounts/my-accounts");
      setMyAccounts(res.data);

      const activeAccounts = res.data.filter((acc) => acc.status === "RUNNING");
      if (activeAccounts.length > 0) {
        setSelectedAccountId(activeAccounts[0].id);

        // Default the "Send From" account to the first active account
        if (!transferFromAccountId) {
          setTransferFromAccountId(activeAccounts[0].id);
        }
      }
    } catch (error) {
      console.error("Failed to fetch accounts", error);
    }
  };

  const fetchTransactions = async (accountId) => {
    try {
      const res = await api.get(`/transactions/${accountId}`);
      setTransactions(res.data);
    } catch (error) {
      console.error("Failed to fetch transactions", error);
    }
  };

  // --- NEW: Fetch Loans Function ---
  const fetchLoans = async (accountNumber) => {
    try {
      const res = await api.get(`/loans/${accountNumber}/loans`);
      setLoans(res.data);
    } catch (error) {
      console.error("Failed to fetch loans", error);
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await api.get("/auth/profile");
      setProfile(res.data);
    } catch (error) {
      console.error("Failed to fetch profile", error);
    }
  };

  // --- Handle Money Transfer ---
  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        senderAccountId: transferFromAccountId,
        receiverAccountNumber: transferToAccountNum,
        amount: transferAmount,
        description: transferDescription,
      };

      await api.post("/transactions/transfer", payload);

      alert("Transfer completed successfully!");

      // Reset the form fields
      setTransferToAccountNum("");
      setTransferAmount("");
      setTransferDescription("");

      // Refresh the user's accounts to show the new updated balances
      fetchMyAccounts();
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Transfer failed",
      );
    }
  };

  // --- Handle Account Closure ---
  const handleCloseAccount = async (e) => {
    e.preventDefault();

    // FIX: If the state is empty because they didn't touch the dropdown,
    // grab the account number of the first active account in the list.
    const finalAccountNum =
      accountToCloseNum || activeAccountsList[0]?.accountNumber;

    if (!finalAccountNum) {
      alert("No active account available to close.");
      return;
    }

    if (
      !window.confirm(
        `Are you sure you want to close account ${finalAccountNum}? A non-refundable ₹30.00 closure fee will be deducted.`,
      )
    ) {
      return;
    }

    try {
      await api.post("/accounts/close-my-account", {
        accountNumber: finalAccountNum,
      });

      alert("Account closed successfully. Thank you for banking with us.");

      setAccountToCloseNum(""); // Reset selection
      fetchMyAccounts(); // Refresh account list
      setActiveTab("account-info");
    } catch (error) {
      alert(
        error.response?.data?.error ||
          error.response?.data?.message ||
          "Failed to close account.",
      );
    }
  };

  // Helper to get only active accounts for dropdowns
  const activeAccountsList = myAccounts.filter(
    (acc) => acc.status === "RUNNING",
  );

  // Function to render the correct view based on the active tab
  const renderContent = () => {
    switch (activeTab) {
      case "send-money":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Send Money
            </h2>
            <p className="text-gray-600 mb-6">
              Transfer funds securely to any Children's Bank of India account.
            </p>

            {activeAccountsList.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 max-w-md border border-gray-100">
                You need an active, approved account to send money.
              </div>
            ) : (
              <form
                onSubmit={handleTransfer}
                className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-lg space-y-4 border border-gray-100"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    From Account *
                  </label>
                  <select
                    value={transferFromAccountId}
                    onChange={(e) => setTransferFromAccountId(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountType} - {acc.accountNumber} (Available: ₹
                        {parseFloat(acc.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Receiver's Account Number *
                  </label>
                  <input
                    type="text"
                    value={transferToAccountNum}
                    onChange={(e) => setTransferToAccountNum(e.target.value)}
                    placeholder="Enter 12-digit account number"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    placeholder="0.00"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Description / Note
                  </label>
                  <input
                    type="text"
                    value={transferDescription}
                    onChange={(e) => setTransferDescription(e.target.value)}
                    placeholder="e.g., Rent, Dinner, etc."
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-2"
                >
                  Confirm & Send Money
                </button>
              </form>
            )}
          </div>
        );
      case "transactions":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Transaction History
            </h2>
            <p className="text-gray-600 mb-6">
              View your past deposits, withdrawals, and transfers.
            </p>

            {activeAccountsList.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 max-w-md border border-gray-100">
                You do not have any active accounts to view transactions for.
              </div>
            ) : (
              <>
                <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 inline-block">
                  <label className="font-bold text-gray-700 mr-3">
                    Select Account:
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountType} - {acc.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {transactions.length === 0 ? (
                  <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 border border-gray-100">
                    No transactions found for this account.
                  </div>
                ) : (
                  <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Date & Time
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Sender Acc
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Receiver Acc
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Amount
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Balance
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {transactions.map((tx) => {
                            const isAddition =
                              tx.type === "DEPOSIT" ||
                              tx.type === "TRANSFER_IN";
                            const transactionType = isAddition
                              ? "Credit"
                              : "Debit";
                            const amountColorClass = isAddition
                              ? "text-green-600"
                              : "text-red-600";
                            const amountPrefix = isAddition ? "+" : "-";

                            return (
                              <tr
                                key={tx.id}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {new Date(tx.createdAt).toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                  {tx.senderAccountNumber || "-"}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                  {tx.receiverAccountNumber || "-"}
                                </td>
                                <td
                                  className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${amountColorClass}`}
                                >
                                  {transactionType}
                                </td>
                                <td
                                  className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${amountColorClass}`}
                                >
                                  {amountPrefix} ₹
                                  {parseFloat(tx.amount).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                  ₹{parseFloat(tx.balanceAfter).toFixed(2)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case "loans":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">My Loans</h2>
            <p className="text-gray-600 mb-6">
              View the status and details of your active and pending loans.
            </p>

            {activeAccountsList.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 max-w-md border border-gray-100">
                You need an active account to view loans.
              </div>
            ) : (
              <>
                <div className="mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100 inline-block">
                  <label className="font-bold text-gray-700 mr-3">
                    Select Linked Account:
                  </label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountType} - {acc.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>

                {loans.length === 0 ? (
                  <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 border border-gray-100">
                    No loans found linked to this account.
                  </div>
                ) : (
                  <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-blue-50">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Loan No.
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Base Amount
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Rate
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Next EMI
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              EMIs Left
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-bold text-blue-800 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                          {loans.map((loan) => {
                            let statusClasses = "bg-gray-100 text-gray-800";
                            if (loan.status === "ACTIVE")
                              statusClasses = "bg-green-100 text-green-800";
                            else if (loan.status === "PENDING")
                              statusClasses = "bg-yellow-100 text-yellow-800";
                            else if (loan.status === "DEFAULTED")
                              statusClasses = "bg-red-100 text-red-800";

                            return (
                              <tr
                                key={loan.id}
                                className="hover:bg-gray-50 transition-colors"
                              >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-800">
                                  {loan.loanNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {loan.loanType}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                  ₹{parseFloat(loan.baseAmount).toFixed(2)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                  {loan.interestRate}%
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">
                                  {loan.nextEmiDate ? (
                                    <>
                                      <span className="font-bold">
                                        ₹
                                        {parseFloat(loan.nextEmiAmount).toFixed(
                                          2,
                                        )}
                                      </span>
                                      <br />
                                      <span className="text-xs text-gray-500">
                                        Due: {loan.nextEmiDate}
                                      </span>
                                    </>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                                  {loan.emisLeft}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                  <div className="flex flex-col items-start gap-2">
                                    <span
                                      className={`px-2.5 py-1 inline-flex text-xs leading-5 font-bold rounded-md ${statusClasses}`}
                                    >
                                      {loan.status}
                                    </span>

                                    {loan.status === "ACTIVE" && (
                                      <button
                                        onClick={() => {
                                          setPayingLoan(loan);
                                          setEmiPayFromAccountId(
                                            activeAccountsList[0]?.id,
                                          );
                                          setActiveTab("pay-emi-form");
                                        }}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm"
                                      >
                                        Pay EMI
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      case "pay-emi-form":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Pay Loan EMI
            </h2>
            <button
              onClick={() => setActiveTab("loans")}
              className="text-blue-600 hover:text-blue-800 hover:underline font-semibold text-sm mb-6 flex items-center transition"
            >
              <span className="mr-1">&larr;</span> Back to My Loans
            </button>

            {payingLoan ? (
              <form
                onSubmit={handlePayEmi}
                className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-md space-y-4 border border-gray-100"
              >
                <div className="bg-blue-50 p-5 rounded-xl border border-blue-100 mb-6">
                  <h3 className="text-lg font-black text-blue-800 mb-3 border-b border-blue-200 pb-2">
                    Loan {payingLoan.loanNumber}
                  </h3>
                  <div className="space-y-2 text-sm text-gray-700">
                    <p>
                      <strong className="text-gray-900">Type:</strong>{" "}
                      {payingLoan.loanType}
                    </p>
                    <p>
                      <strong className="text-gray-900">EMI Amount Due:</strong>{" "}
                      <span className="font-bold text-blue-700 text-base">
                        ₹{parseFloat(payingLoan.nextEmiAmount).toFixed(2)}
                      </span>
                    </p>
                    <p>
                      <strong className="text-gray-900">EMIs Remaining:</strong>{" "}
                      {payingLoan.emisLeft}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Pay From Account *
                  </label>
                  <select
                    value={emiPayFromAccountId}
                    onChange={(e) => setEmiPayFromAccountId(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.accountType} - {acc.accountNumber} (Available: ₹
                        {parseFloat(acc.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-2"
                >
                  Confirm & Pay ₹
                  {parseFloat(payingLoan.nextEmiAmount).toFixed(2)}
                </button>
              </form>
            ) : (
              <p className="text-gray-500">
                No loan selected. Please return to the loans tab.
              </p>
            )}
          </div>
        );
      case "profile":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              My Profile
            </h2>
            <p className="text-gray-600 mb-6">
              View your personal details and account statistics below.
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

                {/* <button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-md mt-4">
                  Request Profile Update
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
     
        // case "open-account":
        // return (
        //   <div className="animate-fade-in">
        //     <h2 className="text-2xl font-bold text-gray-800 mb-2">
        //       Open a New Account
        //     </h2>
        //     <p className="text-gray-600">
        //       Form to request a new Savings or Current account goes here.
        //     </p>
        //   </div>
        // );
     
        case "request-loan":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Request a Loan
            </h2>
            <p className="text-gray-600 mb-6">
              Apply for a loan. Once approved by an Admin, funds will be
              disbursed to your account.
            </p>

            {activeAccountsList.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 max-w-md border border-gray-100">
                You need an active, approved account to apply for a loan.
              </div>
            ) : (
              <form
                onSubmit={handleRequestLoan}
                className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-lg space-y-4 border border-gray-100"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Deposit To Account *
                  </label>
                  <select
                    value={
                      reqLoanAccountNum || activeAccountsList[0]?.accountNumber
                    }
                    onChange={(e) => setReqLoanAccountNum(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.accountNumber}>
                        {acc.accountType} - {acc.accountNumber}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Loan Type *
                  </label>
                  <select
                    value={reqLoanType}
                    onChange={(e) => setReqLoanType(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white"
                  >
                    <option value="PERSONAL">PERSONAL (Est. 12.0%)</option>
                    <option value="HOME">HOME (Est. 7.5%)</option>
                    <option value="EDUCATION">EDUCATION (Est. 6.5%)</option>
                    <option value="CAR">CAR (Est. 9.0%)</option>
                    <option value="BUSINESS">BUSINESS (Est. 10.0%)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Requested Amount (₹) *
                  </label>
                  <input
                    type="number"
                    min="1000"
                    step="0.01"
                    value={reqLoanAmount}
                    onChange={(e) => setReqLoanAmount(e.target.value)}
                    placeholder="Minimum ₹1000"
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
                    value={reqLoanEmis}
                    onChange={(e) => setReqLoanEmis(e.target.value)}
                    placeholder="e.g., 60 for 5 years"
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 p-4 rounded-lg mt-6">
                  <p className="text-sm text-gray-700">
                    <strong className="text-gray-900">Note:</strong> A
                    non-refundable{" "}
                    <strong className="text-red-600">
                      ₹20.00 processing fee
                    </strong>{" "}
                    will be deducted immediately upon submission. Your final EMI
                    amount and interest rate will be locked in upon Admin
                    approval.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-4"
                >
                  Submit Loan Application
                </button>
              </form>
            )}
          </div>
        );
      case "close-account":
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Close an Account
            </h2>
            <p className="text-gray-600 mb-6">
              To process an account closure, your balance must be{" "}
              <strong className="text-gray-800">exactly ₹30.00</strong> to cover
              the system closure fee.
            </p>

            {activeAccountsList.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 max-w-md border border-gray-100">
                You do not have any active accounts to close.
              </div>
            ) : (
              <form
                onSubmit={handleCloseAccount}
                className="bg-white shadow-xl rounded-2xl p-6 md:p-8 w-full max-w-md space-y-4 border border-gray-100"
              >
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">
                    Select Account to Close *
                  </label>
                  <select
                    value={
                      accountToCloseNum || activeAccountsList[0]?.accountNumber
                    }
                    onChange={(e) => setAccountToCloseNum(e.target.value)}
                    required
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-red-500 transition bg-white"
                  >
                    {activeAccountsList.map((acc) => (
                      <option key={acc.id} value={acc.accountNumber}>
                        {acc.accountType} - {acc.accountNumber} (Balance: ₹
                        {parseFloat(acc.balance).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mt-4">
                  <p className="text-sm text-yellow-800">
                    <strong className="text-yellow-900">Note:</strong> If your
                    balance is higher or lower than ₹30.00, the system will
                    reject the closure. Please use the "Send Money" or transfer
                    features to adjust your balance to exactly ₹30.00 first.
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white py-3 rounded-lg font-bold transition shadow-md mt-4"
                >
                  Pay ₹30 & Close Account
                </button>
              </form>
            )}
          </div>
        );
      case "account-info":
      default:
        return (
          <div className="animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              Account Information
            </h2>
            <p className="text-gray-600 mb-6">
              View your current balances, statuses, and account details below.
            </p>

            {myAccounts.length === 0 ? (
              <div className="bg-white shadow-xl rounded-2xl p-6 text-center text-gray-500 border border-gray-100 max-w-md">
                No accounts found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {myAccounts.map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-white shadow-lg rounded-2xl p-6 border border-gray-100 hover:shadow-xl transition-shadow duration-300 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-16 h-16 bg-blue-50 rounded-bl-full -z-10"></div>
                    <h3 className="text-xl font-black text-blue-700 mb-4 pb-3 border-b border-gray-100">
                      {acc.accountType} Account
                    </h3>

                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">
                          Account Number
                        </p>
                        <p className="text-gray-800 font-bold tracking-wide">
                          {acc.accountNumber || (
                            <span className="text-gray-400 italic">
                              Awaiting Approval
                            </span>
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">
                          Status
                        </p>
                        <span
                          className={`inline-block mt-1 px-2.5 py-1 text-xs font-bold rounded-md uppercase tracking-wider ${
                            acc.status === "RUNNING"
                              ? "bg-green-100 text-green-800"
                              : acc.status === "PENDING"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {acc.status}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase font-semibold">
                          Available Balance
                        </p>
                        <p className="text-2xl font-black text-gray-900 mt-1">
                          ₹{parseFloat(acc.balance).toFixed(2)}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 mt-2">
                        <div>
                          <p className="text-xs text-gray-500 uppercase font-semibold">
                            Interest Rate
                          </p>
                          <p className="text-gray-800 font-medium">
                            {acc.interestRate}%
                          </p>
                        </div>
                        {acc.openingDate && (
                          <div>
                            <p className="text-xs text-gray-500 uppercase font-semibold">
                              Opened On
                            </p>
                            <p className="text-gray-800 font-medium">
                              {new Date(acc.openingDate).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
            Customer Portal
          </span>
        </div>

        <ul className="flex flex-row md:flex-col gap-1 p-4 overflow-x-auto md:overflow-y-auto flex-1 hide-scrollbar">
          {[
            { id: "account-info", label: "Account Info" },
            { id: "send-money", label: "Send Money" },
            { id: "transactions", label: "Transaction History" },
            { id: "loans", label: "My Loans" },
            // { id: "open-account", label: "Open Account" },
            { id: "request-loan", label: "Apply for Loan" },
            { id: "close-account", label: "Close Account" },
            { id: "profile", label: "My Profile" },
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
