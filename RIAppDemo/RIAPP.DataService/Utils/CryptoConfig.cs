using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Configuration;
using System.Security.Cryptography;
using System.Web;
using System.Web.Configuration;


namespace RIAPP.DataService
{
    public static class CryptConfig
    {
        private static string _hmac_pass;
        private static string _crypt_pass;
        private static byte[] _hmac_key;
        private static byte[] _crypt_key;

        private static void InitKeys()
        {
            lock (typeof(CryptConfig))
            {
                string apath = HttpContext.Current.Request.ApplicationPath;
                Configuration config = WebConfigurationManager.OpenWebConfiguration(apath);
                MachineKeySection key = (MachineKeySection)config.GetSection("system.web/machineKey");
                _crypt_pass = key.DecryptionKey;
                _hmac_pass = key.ValidationKey;

                PasswordDeriveBytes pdb = new PasswordDeriveBytes(_hmac_pass, null);
                byte[] iv = new byte[] { 0, 0, 0, 0, 0, 0, 0, 0 };
                _hmac_key = pdb.CryptDeriveKey("RC2", "SHA1", 128, iv);
                _crypt_key = pdb.CryptDeriveKey("RC2", "SHA1", 128, iv);
            }
        }

        internal static string HMAC_PASS
        {
            get
            {
                if (_hmac_pass == null)
                {
                    InitKeys();
                }

                return _hmac_pass;
            }
        }

        internal static string CRYPT_PASS
        {
            get
            {
                if (_crypt_pass == null)
                {
                    InitKeys();
                }

                return _crypt_pass;
            }
        }

        internal static byte[] HMAC_Key
        {
            get
            {
                if (_hmac_pass == null)
                {
                    InitKeys();
                }

                return _hmac_key;
            }
        }

        internal static byte[] CRYPT_Key
        {
            get
            {
                if (_crypt_pass == null)
                {
                    InitKeys();
                }

                return _crypt_key;
            }
        }
    }
}
