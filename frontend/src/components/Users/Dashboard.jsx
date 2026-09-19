import TransactionChart from "../Transactions/TransactionChart";
import TransactionList from "../Transactions/TransactionList";
import PendingTransactions from "../Transactions/PendingTransactions";

const Dashboard = () => {
  return (
    <>
      {/* Lo registrado sin conexión que aún no llegó al servidor */}
      <PendingTransactions />
      <TransactionChart />
      <TransactionList />
    </>
  );
};

export default Dashboard;
