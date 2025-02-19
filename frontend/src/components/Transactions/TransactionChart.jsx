import React from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  plugins,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useQuery } from "@tanstack/react-query";
import { listTransationsAPI } from "../../services/transactions/transactionService";

ChartJS.register(ArcElement, Tooltip, Legend);

const TransactionChart = () => {
  const {
    data: transactions,
    isError,
    error,
    isLoading,
    isFetched,
    refetch,
  } = useQuery({
    queryFn: listTransationsAPI,
    queryKey: ["list-transactions", "list-categories", "login"],
  });

  //!calculate total income and expense with "reduce function"
  const totals = transactions?.reduce(
    (acc, transaction) => {
      if (transaction?.type === "income") {
        acc.income += transaction?.amount;
      } else {
        acc.expense += transaction?.amount;
      }
      return acc;
    },
    { income: 0, expense: 0 }
  );

  //!Data structure for chart
  const data = {
    labels: ["Income", "Expense"],
    datasets: [
      {
        label: "Transactions",
        data: [totals?.income, totals?.expense],
        backgroundColor: ["#36A2EB", "#FF6384"],
        borderColor: ["#36A2EB", "#FF6384"],
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          padding: 25,
          boxWidth: 12,
          font: {
            size: 14,
          },
        },
      },
      title: {
        display: true,
        text: "Income vs Expense",
        font: {
          size: 18,
          weight: "bold",
        },
        padding: {
          top: 10,
          bottom: 30,
        },
      },
    },
    cutout: "70%",
  };
  return (
    <>
      <div className="my-8 p-6 bg-white rounded-lg shadow-xl border border-gray-200">
        <h1 className="text-2xl font-bold text-center mb-4">
          Transaction Overview
        </h1>
        <div
          style={{ height: "350px" }}
          className="relative flex justify-center items-center"
        >
          <div className="flex flex-col items-center justify-center max-w-2xl p-4 px-auto mx-auto absolute top-10">
            <div className="items-center justify-center">
              <h3 className=" text-xl text-center text-blue-500 px-2 py-1 rounded-md">
                Income
              </h3>
              <h3 className="font-semibold text-xl text-gray-700 text-center ">
                S./{totals?.income}
              </h3>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center max-w-2xl p-4 px-auto mx-auto absolute">
            <div className="items-center justify-center">
              <h3 className=" text-xl text-center text-red-500 px-2 py-1 rounded-md">
                Expense
              </h3>
              <h3 className="font-semibold text-gray-700 text-xl text-center ">
                S/.{totals?.expense}
              </h3>
            </div>
            <h3 className="text-xl font-semibold text-[#36A2EB] mt-3 text-center ">
              Total S/.{totals?.income - totals?.expense}
            </h3>
          </div>
          <Doughnut data={data} options={options} />
        </div>
      </div>
    </>
  );
};

export default TransactionChart;
