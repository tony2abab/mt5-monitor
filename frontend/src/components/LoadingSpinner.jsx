function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 border-4 border-cyber-blue/20 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-transparent border-t-cyber-blue rounded-full animate-spin"></div>
      </div>
      <p className="mt-4 text-gray-400">載入中...</p>
    </div>
  )
}

export default LoadingSpinner
