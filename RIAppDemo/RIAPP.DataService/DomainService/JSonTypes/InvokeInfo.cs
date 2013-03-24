using System.Runtime.Serialization;

namespace RIAPP.DataService
{
    [DataContract]
    public class InvokeInfo
    {
        private MethodParamInfo _paramInfo = new MethodParamInfo();
     
        [DataMember]
        public string methodName
        {
            get;
            set;
        }

        [DataMember]
        public MethodParamInfo paramInfo
        {
            get { return _paramInfo; }
            set { _paramInfo = value; }
        }
    }
}
